import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import type { Edge, Node, XYPosition } from '@xyflow/react'
import { getResource, type ResourceType } from '@/resources'
import { canBeTopLevel, canContain, requiredParentLabel } from '@/graph/rules'
import { simulate, type SimResult } from '@/graph/simulate'
import { sanitizeSnapshot } from '@/graph/share'

export type Mode = 'free' | 'challenge'

/** Transient toast: errors are rose, info (e.g. "link copied") is emerald. */
export interface Notice {
  text: string
  kind: 'error' | 'info'
}

export interface NodeData {
  type: ResourceType
  label: string
  config: Record<string, unknown>
  [key: string]: unknown
}

export type ResourceNodeType = Node<NodeData>

/** Which of the three side panels are open as overlay drawers on mobile. */
export type DrawerKey = 'palette' | 'inspector' | 'missions'
export type MobileDrawers = Record<DrawerKey, boolean>

/** Matches Tailwind's default `md` breakpoint: anything below 768px is mobile. */
function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

interface GraphState {
  mode: Mode
  nodes: ResourceNodeType[]
  edges: Edge[]
  selectedNodeId: string | null
  activeMissionId: string | null
  /** Transient, player-facing message (e.g. a rejected drop/edge). */
  notice: Notice | null
  mobileDrawers: MobileDrawers
  /** Result of the last/current traffic simulation run (Phase 3), or null. */
  simulation: SimResult | null
  /** MiniMap visibility — defaults off on small screens where it hides the canvas. */
  showMiniMap: boolean

  setMode: (mode: Mode) => void
  /** Click-to-add: places the node into a valid container automatically. */
  addNode: (type: ResourceType) => void
  /** Drop-to-add: places the node at `position`, optionally inside `parentId`. */
  addNodeAt: (type: ResourceType, position: XYPosition, parentId?: string) => void
  removeNode: (id: string) => void
  /** Updates a single key in a node's `data.config` (Inspector edits). */
  updateNodeConfig: (id: string, key: string, value: unknown) => void
  /** Renames a node (player-facing label, used for Terraform tags). */
  updateNodeLabel: (id: string, label: string) => void
  setNodes: (nodes: ResourceNodeType[]) => void
  setEdges: (edges: Edge[]) => void
  setSelected: (id: string | null) => void
  setActiveMission: (id: string | null) => void
  setNotice: (text: string | null, kind?: Notice['kind']) => void
  setDrawer: (which: DrawerKey, open: boolean) => void
  /** Replaces the whole design (shared URL / JSON import). */
  loadDesign: (nodes: ResourceNodeType[], edges: Edge[], missionId?: string) => void
  /** Best star record per mission id — persisted (Editor Fundamentals sprint). */
  bestStars: Record<string, number>
  /** Records a mission result, keeping the historical maximum. */
  recordStars: (missionId: string, stars: number) => void
  /** Runs the traffic simulation over the current graph and stores the result. */
  runSimulation: () => void
  /** Clears the current simulation highlight. */
  stopSimulation: () => void
  toggleMiniMap: () => void
  reset: () => void
}

/** Seed graph: a VPC ▸ public Subnet ▸ EC2, demonstrating valid nesting. */
const initialNodes: ResourceNodeType[] = [
  {
    id: 'vpc-1',
    type: 'resource',
    position: { x: 80, y: 40 },
    style: { width: 480, height: 340 },
    data: { type: 'vpc', label: 'VPC', config: { cidr_block: '10.0.0.0/16' } },
  },
  {
    id: 'subnet-1',
    type: 'resource',
    position: { x: 40, y: 70 },
    style: { width: 320, height: 190 },
    parentId: 'vpc-1',
    extent: 'parent',
    data: {
      type: 'subnet',
      label: 'Public Subnet',
      config: { cidr_block: '10.0.1.0/24', az: 'a', public: true },
    },
  },
  {
    id: 'ec2-1',
    type: 'resource',
    position: { x: 40, y: 70 },
    parentId: 'subnet-1',
    extent: 'parent',
    data: {
      type: 'ec2',
      label: 'EC2 Instance',
      config: { instance_type: 't3.micro', ami: 'auto' },
    },
  },
]

// Monotonic counter so newly-added nodes never collide with seeded ids. It is
// re-seeded from the highest existing suffix on rehydrate/import, so restored
// designs never mint duplicate ids.
let nodeSeq = initialNodes.length

function bumpNodeSeq(nodes: ResourceNodeType[]) {
  for (const n of nodes) {
    const tail = Number(n.id.split('-').pop())
    if (Number.isFinite(tail) && tail > nodeSeq) nodeSeq = tail
  }
}

/** Builds a resource node, applying a container's default size when relevant. */
function makeNode(
  type: ResourceType,
  position: XYPosition,
  parentId?: string,
): ResourceNodeType {
  const meta = getResource(type)
  nodeSeq += 1
  const node: ResourceNodeType = {
    id: `${type}-${nodeSeq}`,
    type: 'resource',
    position,
    data: { type, label: meta.label, config: { ...meta.defaults } },
  }
  if (meta.defaultSize) node.style = { ...meta.defaultSize }
  if (parentId) {
    node.parentId = parentId
    node.extent = 'parent'
  }
  return node
}

/** Collects a node id plus all of its (transitive) descendants. */
function withDescendants(nodes: ResourceNodeType[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id)
        grew = true
      }
    }
  }
  return ids
}

/**
 * Debounced-leading history capture (ADR 0023): continuous gestures (node
 * drags, container resizes, typing bursts) emit dozens of set() calls; we keep
 * only the FIRST pre-gesture state per 300ms-quiet window, so one gesture =
 * one undo step.
 */
function debouncedLeadingHandleSet<T>(
  handleSet: (pastState: T) => void,
): (pastState: T) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: T | undefined
  return (pastState) => {
    if (pending === undefined) pending = pastState
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (pending !== undefined) handleSet(pending)
      pending = undefined
    }, 300)
  }
}

export const useGraphStore = create<GraphState>()(
  temporal(
    persist(
      (set) => ({
  mode: 'free',
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  activeMissionId: null,
  notice: null,
  mobileDrawers: { palette: false, inspector: false, missions: false },
  simulation: null,
  showMiniMap: !isMobileViewport(),

  setMode: (mode) => set({ mode }),

  addNode: (type) =>
    set((state) => {
      // Top-level resources fan out onto open canvas.
      if (canBeTopLevel(type)) {
        const offset = (state.nodes.length % 6) * 28
        const node = makeNode(type, { x: 560 + offset, y: 120 + offset })
        return {
          nodes: [...state.nodes, node],
          selectedNodeId: node.id,
          notice: null,
          simulation: null,
        }
      }
      // Nested resources need an existing valid container.
      const parent = state.nodes.find((n) => canContain(n.data.type, type))
      if (!parent) {
        const need = requiredParentLabel(type)
        return {
          notice: {
            text: `${getResource(type).label}은(는) ${need} 안에만 놓을 수 있습니다. 먼저 ${need}을(를) 추가하세요.`,
            kind: 'error' as const,
          },
        }
      }
      const siblings = state.nodes.filter((n) => n.parentId === parent.id).length
      const fan = (siblings % 4) * 22
      const node = makeNode(type, { x: 24 + fan, y: 48 + fan }, parent.id)
      return {
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
        notice: null,
        simulation: null,
      }
    }),

  addNodeAt: (type, position, parentId) =>
    set((state) => {
      const node = makeNode(type, position, parentId)
      return {
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
        notice: null,
        simulation: null,
      }
    }),

  removeNode: (id) =>
    set((state) => {
      const doomed = withDescendants(state.nodes, id)
      return {
        nodes: state.nodes.filter((n) => !doomed.has(n.id)),
        edges: state.edges.filter((e) => !doomed.has(e.source) && !doomed.has(e.target)),
        selectedNodeId:
          state.selectedNodeId && doomed.has(state.selectedNodeId)
            ? null
            : state.selectedNodeId,
        simulation: null,
      }
    }),

  updateNodeConfig: (id, key, value) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
          : n,
      ),
    })),

  updateNodeLabel: (id, label) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      ),
    })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  setSelected: (selectedNodeId) =>
    set((state) => {
      // On mobile the Inspector is a drawer; selecting a node should surface it.
      if (selectedNodeId && isMobileViewport()) {
        return {
          selectedNodeId,
          mobileDrawers: { ...state.mobileDrawers, inspector: true },
        }
      }
      return { selectedNodeId }
    }),

  setActiveMission: (activeMissionId) => set({ activeMissionId }),
  setNotice: (text, kind = 'error') => set({ notice: text === null ? null : { text, kind } }),

  setDrawer: (which, open) =>
    set((state) => ({ mobileDrawers: { ...state.mobileDrawers, [which]: open } })),

  loadDesign: (nodes, edges, missionId) => {
    bumpNodeSeq(nodes)
    set({
      nodes,
      edges,
      selectedNodeId: null,
      activeMissionId: missionId ?? null,
      ...(missionId ? { mode: 'challenge' as const } : {}),
      simulation: null,
      notice: null,
    })
  },

  bestStars: {},
  recordStars: (missionId, stars) =>
    set((state) =>
      stars > (state.bestStars[missionId] ?? 0)
        ? { bestStars: { ...state.bestStars, [missionId]: stars } }
        : state,
    ),

  runSimulation: () =>
    set((state) => ({ simulation: simulate(state.nodes, state.edges) })),

  stopSimulation: () => set({ simulation: null }),

  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),

  reset: () =>
    set({
      nodes: initialNodes,
      edges: [],
      selectedNodeId: null,
      activeMissionId: null,
      notice: null,
      mobileDrawers: { palette: false, inspector: false, missions: false },
      simulation: null,
    }),
      }),
      {
        // Autosave (ADR 0020): the design survives refresh/close. Only durable
        // design state is persisted — transient UI (selection, notices,
        // drawers, simulation) always starts fresh.
        name: 'cidrunner-design',
        version: 1,
        partialize: (s) => ({
          nodes: s.nodes,
          edges: s.edges,
          mode: s.mode,
          activeMissionId: s.activeMissionId,
          bestStars: s.bestStars,
        }),
        // Rehydrate through the same whitelist as shared URLs (ADR 0023). If
        // the stored graph fails sanitation we keep it as-is — local data is
        // trusted more than a foreign URL, and dropping a design is worse.
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Record<string, unknown>
          const merged = { ...current, ...p } as GraphState
          if (Array.isArray(p.nodes)) {
            const clean = sanitizeSnapshot({ v: 1, nodes: p.nodes, edges: p.edges ?? [] })
            if (clean) {
              merged.nodes = clean.nodes
              merged.edges = clean.edges
            }
          }
          return merged
        },
        onRehydrateStorage: () => (state) => {
          if (state) bumpNodeSeq(state.nodes)
        },
      },
    ),
    {
      // Undo/redo tracks only the design graph (ADR 0023).
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
      equality: (a, b) => a.nodes === b.nodes && a.edges === b.edges,
      handleSet: (handleSet) => debouncedLeadingHandleSet(handleSet),
      limit: 100,
    },
  ),
)

/** Undo the last design change; transient state is reset alongside. */
export function undoDesign() {
  useGraphStore.temporal.getState().undo()
  useGraphStore.setState({ simulation: null, selectedNodeId: null })
}

/** Redo the last undone design change. */
export function redoDesign() {
  useGraphStore.temporal.getState().redo()
  useGraphStore.setState({ simulation: null, selectedNodeId: null })
}
