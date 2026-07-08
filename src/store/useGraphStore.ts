import { create } from 'zustand'
import type { Edge, Node, XYPosition } from '@xyflow/react'
import { getResource, type ResourceType } from '@/resources'
import { canBeTopLevel, canContain, requiredParentLabel } from '@/graph/rules'

export type Mode = 'free' | 'challenge'

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
  notice: string | null
  mobileDrawers: MobileDrawers

  setMode: (mode: Mode) => void
  /** Click-to-add: places the node into a valid container automatically. */
  addNode: (type: ResourceType) => void
  /** Drop-to-add: places the node at `position`, optionally inside `parentId`. */
  addNodeAt: (type: ResourceType, position: XYPosition, parentId?: string) => void
  removeNode: (id: string) => void
  setNodes: (nodes: ResourceNodeType[]) => void
  setEdges: (edges: Edge[]) => void
  setSelected: (id: string | null) => void
  setActiveMission: (id: string | null) => void
  setNotice: (notice: string | null) => void
  setDrawer: (which: DrawerKey, open: boolean) => void
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
      config: { cidr_block: '10.0.1.0/24', public: true },
    },
  },
  {
    id: 'ec2-1',
    type: 'resource',
    position: { x: 40, y: 70 },
    parentId: 'subnet-1',
    extent: 'parent',
    data: { type: 'ec2', label: 'EC2 Instance', config: { instance_type: 't3.micro' } },
  },
]

// Monotonic counter so newly-added nodes never collide with seeded ids.
let nodeSeq = initialNodes.length

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

export const useGraphStore = create<GraphState>((set) => ({
  mode: 'free',
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  activeMissionId: null,
  notice: null,
  mobileDrawers: { palette: false, inspector: false, missions: false },

  setMode: (mode) => set({ mode }),

  addNode: (type) =>
    set((state) => {
      // Top-level resources fan out onto open canvas.
      if (canBeTopLevel(type)) {
        const offset = (state.nodes.length % 6) * 28
        const node = makeNode(type, { x: 560 + offset, y: 120 + offset })
        return { nodes: [...state.nodes, node], selectedNodeId: node.id, notice: null }
      }
      // Nested resources need an existing valid container.
      const parent = state.nodes.find((n) => canContain(n.data.type, type))
      if (!parent) {
        const need = requiredParentLabel(type)
        return {
          notice: `${getResource(type).label}은(는) ${need} 안에만 놓을 수 있습니다. 먼저 ${need}을(를) 추가하세요.`,
        }
      }
      const siblings = state.nodes.filter((n) => n.parentId === parent.id).length
      const fan = (siblings % 4) * 22
      const node = makeNode(type, { x: 24 + fan, y: 48 + fan }, parent.id)
      return { nodes: [...state.nodes, node], selectedNodeId: node.id, notice: null }
    }),

  addNodeAt: (type, position, parentId) =>
    set((state) => {
      const node = makeNode(type, position, parentId)
      return { nodes: [...state.nodes, node], selectedNodeId: node.id, notice: null }
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
      }
    }),

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
  setNotice: (notice) => set({ notice }),

  setDrawer: (which, open) =>
    set((state) => ({ mobileDrawers: { ...state.mobileDrawers, [which]: open } })),

  reset: () =>
    set({
      nodes: initialNodes,
      edges: [],
      selectedNodeId: null,
      activeMissionId: null,
      notice: null,
      mobileDrawers: { palette: false, inspector: false, missions: false },
    }),
}))
