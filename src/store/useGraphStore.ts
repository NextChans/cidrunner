import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import type { Edge, Node, XYPosition } from '@xyflow/react'
import { getResource, type ResourceType } from '@/resources'
import { canBeTopLevel, canContain, isContainer, requiredParentLabel } from '@/graph/rules'
import {
  absolutePosition,
  normalizeContainment,
  orderByParent,
} from '@/graph/containment'
import { simulate, type SimResult } from '@/graph/simulate'
import { applyAzFault } from '@/graph/chaos'
import { applyInheritedDefaults } from '@/graph/inherit'
import { sanitizeSnapshot, toSnapshot, type DesignSnapshot } from '@/graph/share'
import {
  assignedSgIds,
  makeSecurityGroup,
  type SecurityGroupDef,
} from '@/graph/securityGroups'
import type { CustomMissionSpec } from '@/missions/custom'

export type Mode = 'free' | 'challenge'

/**
 * A saved design in the gallery (ADR 0033). The snapshot is the same versioned
 * shape used for URL/JSON sharing, so a slot round-trips through the identical
 * sanitizer on load — foreign/corrupt data can't reach the store.
 */
export interface GallerySlot {
  id: string
  name: string
  snapshot: DesignSnapshot
  createdAt: number
  updatedAt: number
}

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

/** Open right-click menu on a node — screen-space anchor (ADR 0028). */
export interface ContextMenuState {
  nodeId: string
  x: number
  y: number
}

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
  /**
   * Live palette search query (ADR 0037). Transient (never persisted) and
   * independent of the mobile palette drawer's open/close state, so a `/`
   * focus + type works regardless of how the palette is surfaced.
   */
  search: string
  /** Result of the last/current traffic simulation run (Phase 3), or null. */
  simulation: SimResult | null
  /** MiniMap visibility — defaults off on small screens where it hides the canvas. */
  showMiniMap: boolean
  /** Playback audio on/off (ADR 0058) — persisted; muting silences mid-pass. */
  soundOn: boolean
  /** Open node context menu (right-click), or null when closed (ADR 0028). */
  contextMenu: ContextMenuState | null
  /**
   * Container currently under a dragged node, for drop-target highlighting
   * (ADR 0040). `valid` reflects whether the rules allow the nesting. Transient
   * — never persisted, never in undo history.
   */
  dropTarget: { id: string; valid: boolean } | null
  /** Whether the keyboard-shortcut help modal is open (ADR 0028). */
  showShortcutHelp: boolean
  /** Whether the gallery modal is open (ADR 0033). */
  showGallery: boolean
  /** Whether the achievements modal is open (ADR 0032). */
  showAchievements: boolean
  /** Whether the "create custom mission" modal is open (ADR 0065). */
  showCreateMission: boolean
  /** Active instructor-authored custom mission spec, or null (ADR 0065). */
  customMission: CustomMissionSpec | null
  /** Saved design slots — persisted (ADR 0033). */
  slots: GallerySlot[]
  /** Ids of badges already announced to the player — persisted (ADR 0032). */
  earnedBadges: string[]
  /**
   * Security-group definitions (ADR 0059). SGs are a firewall ruleset *assigned*
   * to resources (`config.securityGroupIds`), not a canvas node — so they live
   * here, persisted + undoable, and never appear as nodes/edges.
   */
  securityGroups: SecurityGroupDef[]
  /** SG whose members are currently highlighted (chip click), or null. Transient. */
  highlightSgId: string | null

  setMode: (mode: Mode) => void
  /** Click-to-add: places the node into a valid container automatically. */
  addNode: (type: ResourceType) => void
  /** Drop-to-add: places the node at `position`, optionally inside `parentId`. */
  addNodeAt: (type: ResourceType, position: XYPosition, parentId?: string) => void
  removeNode: (id: string) => void
  /**
   * Deletes the current selection: the selected node (+descendants), any
   * React-Flow-selected nodes, and any selected edges (Delete/Backspace).
   */
  deleteSelection: () => void
  /** Clones a node (and its descendants) with fresh ids, offset and selected. */
  duplicateNode: (id: string) => void
  /** Removes every edge touching a node (context-menu "엣지 지우기"). */
  clearNodeEdges: (id: string) => void
  /** Detaches a node from its parent, converting to an absolute position. */
  detachNode: (id: string) => void
  /**
   * Nests a node under `parentId` (drag drop or context-menu "부모에 넣기"),
   * converting its absolute position to parent-relative and re-sorting so the
   * parent precedes the child. No-op if the rules forbid the nesting or it
   * would create a cycle.
   */
  attachToParent: (nodeId: string, parentId: string) => void
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
  /** Sets the live palette search query (ADR 0037). */
  setSearch: (query: string) => void
  /** Replaces the whole design (shared URL / JSON import). */
  loadDesign: (
    nodes: ResourceNodeType[],
    edges: Edge[],
    missionId?: string,
    securityGroups?: SecurityGroupDef[],
  ) => void
  /** Creates a new empty security group and returns its id (ADR 0059). */
  addSecurityGroup: () => string
  /** Patches a security group's name/rules. */
  updateSecurityGroup: (id: string, patch: Partial<Omit<SecurityGroupDef, 'id'>>) => void
  /** Deletes a security group and unassigns it from every resource. */
  removeSecurityGroup: (id: string) => void
  /** Assigns/unassigns a security group to a resource node (toggle). */
  toggleNodeSecurityGroup: (nodeId: string, sgId: string) => void
  /** Highlights the members of a security group on the canvas (chip click). */
  setHighlightSg: (sgId: string | null) => void
  /** Best star record per mission id — persisted (Editor Fundamentals sprint). */
  bestStars: Record<string, number>
  /** Records a mission result, keeping the historical maximum. */
  recordStars: (missionId: string, stars: number) => void
  /** Runs the traffic simulation over the current graph and stores the result. */
  runSimulation: () => void
  /** Clears the current simulation highlight (and any injected fault). */
  stopSimulation: () => void
  /** Chaos mode (ADR 0052): the AZ currently downed by fault injection, or null. */
  chaosAz: string | null
  /** Injects (or clears) an AZ failure and re-runs the sim on the survivors. */
  setChaos: (az: string | null) => void
  toggleMiniMap: () => void
  toggleSound: () => void
  setContextMenu: (menu: ContextMenuState | null) => void
  /** Sets (or clears) the drop-target highlight during a node drag (ADR 0040). */
  setDropTarget: (target: { id: string; valid: boolean } | null) => void
  setShortcutHelp: (open: boolean) => void
  setShowGallery: (open: boolean) => void
  setShowAchievements: (open: boolean) => void
  setShowCreateMission: (open: boolean) => void
  /** Sets (or clears) the custom mission and activates it in challenge mode. */
  setCustomMission: (spec: CustomMissionSpec | null) => void
  /** Saves the current design into a new gallery slot. */
  saveSlot: (name: string) => void
  /** Replaces the canvas with a slot's design (re-sanitized on the way in). */
  loadSlot: (id: string) => void
  deleteSlot: (id: string) => void
  renameSlot: (id: string, name: string) => void
  /** Marks badge ids as announced; returns nothing (idempotent, deduped). */
  markBadges: (ids: string[]) => void
  reset: () => void
}

// Monotonic disambiguator so two slots saved in the same millisecond differ.
let slotSeq = 0

// Monotonic counter for security-group ids, re-seeded from loaded designs so a
// restored collection never mints a duplicate id.
let sgSeq = 0
function bumpSgSeq(sgs: SecurityGroupDef[]) {
  for (const sg of sgs) {
    const tail = Number(sg.id.split('-').pop())
    if (Number.isFinite(tail) && tail > sgSeq) sgSeq = tail
  }
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

/** Runs the sim, applying an AZ fault (ADR 0052/0053) when chaos is active. */
function runWithChaos(
  nodes: ResourceNodeType[],
  edges: Edge[],
  chaosAz: string | null,
): SimResult {
  if (!chaosAz) return simulate(nodes, edges)
  const fault = applyAzFault(nodes, edges, chaosAz)
  return simulate(nodes, fault.edges, {
    deadNodeIds: fault.deadNodeIds,
    failoverIds: fault.failoverIds,
    promotedIds: fault.promotedIds,
  })
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
  search: '',
  simulation: null,
  chaosAz: null,
  showMiniMap: !isMobileViewport(),
  contextMenu: null,
  dropTarget: null,
  showShortcutHelp: false,
  showGallery: false,
  showAchievements: false,
  showCreateMission: false,
  customMission: null,
  slots: [],
  earnedBadges: [],
  securityGroups: [],
  highlightSgId: null,

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
      applyInheritedDefaults(node, state.nodes)
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
      applyInheritedDefaults(node, state.nodes)
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

  deleteSelection: () =>
    set((state) => {
      const roots = new Set<string>()
      if (state.selectedNodeId) roots.add(state.selectedNodeId)
      for (const n of state.nodes) if (n.selected) roots.add(n.id)
      const selectedEdgeIds = new Set(
        state.edges.filter((e) => e.selected).map((e) => e.id),
      )
      if (roots.size === 0 && selectedEdgeIds.size === 0) return state
      const doomed = new Set<string>()
      for (const id of roots) {
        for (const d of withDescendants(state.nodes, id)) doomed.add(d)
      }
      return {
        nodes: state.nodes.filter((n) => !doomed.has(n.id)),
        edges: state.edges.filter(
          (e) =>
            !selectedEdgeIds.has(e.id) &&
            !doomed.has(e.source) &&
            !doomed.has(e.target),
        ),
        selectedNodeId:
          state.selectedNodeId && doomed.has(state.selectedNodeId)
            ? null
            : state.selectedNodeId,
        simulation: null,
        contextMenu: null,
      }
    }),

  duplicateNode: (id) =>
    set((state) => {
      const subtree = withDescendants(state.nodes, id)
      // Mint fresh ids for the whole subtree first, so parent links remap.
      const idMap = new Map<string, string>()
      for (const n of state.nodes) {
        if (!subtree.has(n.id)) continue
        nodeSeq += 1
        idMap.set(n.id, `${n.data.type}-${nodeSeq}`)
      }
      const clones: ResourceNodeType[] = []
      for (const n of state.nodes) {
        const newId = idMap.get(n.id)
        if (!newId) continue
        const clone: ResourceNodeType = {
          ...n,
          id: newId,
          selected: false,
          // Nudge only the subtree root; descendants keep parent-relative coords.
          position:
            n.id === id
              ? { x: n.position.x + 32, y: n.position.y + 32 }
              : { ...n.position },
          data: { ...n.data, config: { ...n.data.config } },
        }
        if (n.style) clone.style = { ...n.style }
        // Re-point at the cloned parent if it is part of the subtree; the root
        // keeps its original parent so it lands beside the source.
        const mappedParent = n.parentId ? idMap.get(n.parentId) : undefined
        if (mappedParent) clone.parentId = mappedParent
        clones.push(clone)
      }
      // Carry over edges internal to the subtree (e.g. a duplicated container).
      const clonedEdges: Edge[] = []
      for (const e of state.edges) {
        const s = idMap.get(e.source)
        const t = idMap.get(e.target)
        if (s && t) clonedEdges.push({ ...e, id: `e-${s}-${t}`, source: s, target: t })
      }
      const rootNewId = idMap.get(id) ?? state.selectedNodeId
      return {
        nodes: [...state.nodes, ...clones],
        edges: [...state.edges, ...clonedEdges],
        selectedNodeId: rootNewId,
        simulation: null,
        contextMenu: null,
      }
    }),

  clearNodeEdges: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      simulation: null,
      contextMenu: null,
    })),

  detachNode: (id) =>
    set((state) => {
      const node = state.nodes.find((n) => n.id === id)
      if (!node || !node.parentId) return state
      // Fold the parent chain into an absolute position so the node stays put.
      const byId = new Map(state.nodes.map((n) => [n.id, n]))
      let { x, y } = node.position
      let pid: string | undefined = node.parentId
      while (pid) {
        const parent = byId.get(pid)
        if (!parent) break
        x += parent.position.x
        y += parent.position.y
        pid = parent.parentId
      }
      return {
        nodes: state.nodes.map((n) =>
          n.id === id
            ? { ...n, parentId: undefined, extent: undefined, position: { x, y } }
            : n,
        ),
        simulation: null,
        contextMenu: null,
      }
    }),

  attachToParent: (nodeId, parentId) =>
    set((state) => {
      if (nodeId === parentId) return state
      const byId = new Map(state.nodes.map((n) => [n.id, n]))
      const node = byId.get(nodeId)
      const parent = byId.get(parentId)
      if (!node || !parent) return state
      // Only containers that the rules allow may become the new parent…
      if (!isContainer(parent.data.type) || !canContain(parent.data.type, node.data.type)) {
        return state
      }
      // …and the target must not be the node's own descendant (no cycles).
      if (withDescendants(state.nodes, nodeId).has(parentId)) return state
      if (node.parentId === parentId) return state

      // Preserve the node's on-canvas position: absolute → new-parent-relative.
      const abs = absolutePosition(byId, nodeId)
      const parentAbs = absolutePosition(byId, parentId)
      const position = { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y }

      const nodes = state.nodes.map((n) =>
        n.id === nodeId ? { ...n, parentId, extent: 'parent' as const, position } : n,
      )
      return { nodes: orderByParent(nodes), simulation: null, contextMenu: null }
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

  setSearch: (search) => set({ search }),

  loadDesign: (nodes, edges, missionId, securityGroups = []) => {
    bumpNodeSeq(nodes)
    bumpSgSeq(securityGroups)
    set({
      nodes: normalizeContainment(nodes),
      edges,
      securityGroups,
      selectedNodeId: null,
      activeMissionId: missionId ?? null,
      ...(missionId ? { mode: 'challenge' as const } : {}),
      simulation: null,
      notice: null,
    })
  },

  addSecurityGroup: () => {
    sgSeq += 1
    const sg = makeSecurityGroup(`sg-${sgSeq}`, sgSeq)
    set((state) => ({ securityGroups: [...state.securityGroups, sg] }))
    return sg.id
  },

  updateSecurityGroup: (id, patch) =>
    set((state) => ({
      securityGroups: state.securityGroups.map((sg) =>
        sg.id === id ? { ...sg, ...patch } : sg,
      ),
    })),

  removeSecurityGroup: (id) =>
    set((state) => ({
      securityGroups: state.securityGroups.filter((sg) => sg.id !== id),
      // Strip the deleted SG from every resource that wore it.
      nodes: state.nodes.map((n) => {
        const ids = assignedSgIds(n)
        if (!ids.includes(id)) return n
        const next = ids.filter((sgId) => sgId !== id)
        const config = { ...n.data.config }
        if (next.length) config.securityGroupIds = next
        else delete config.securityGroupIds
        return { ...n, data: { ...n.data, config } }
      }),
      simulation: null,
      highlightSgId: state.highlightSgId === id ? null : state.highlightSgId,
    })),

  toggleNodeSecurityGroup: (nodeId, sgId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n
        const ids = assignedSgIds(n)
        const next = ids.includes(sgId) ? ids.filter((x) => x !== sgId) : [...ids, sgId]
        const config = { ...n.data.config }
        if (next.length) config.securityGroupIds = next
        else delete config.securityGroupIds
        return { ...n, data: { ...n.data, config } }
      }),
      simulation: null,
    })),

  setHighlightSg: (highlightSgId) => set({ highlightSgId }),

  bestStars: {},
  recordStars: (missionId, stars) =>
    set((state) =>
      stars > (state.bestStars[missionId] ?? 0)
        ? { bestStars: { ...state.bestStars, [missionId]: stars } }
        : state,
    ),

  runSimulation: () =>
    set((state) => ({ simulation: runWithChaos(state.nodes, state.edges, state.chaosAz) })),

  stopSimulation: () => set({ simulation: null, chaosAz: null }),

  // Chaos mode (ADR 0052/0053): down an AZ (or clear with null) and immediately
  // re-run the sim on the survivors so the impact is visible.
  setChaos: (az) =>
    set((state) => ({
      chaosAz: az,
      simulation: runWithChaos(state.nodes, state.edges, az),
    })),

  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),

  soundOn: true,
  toggleSound: () => set((state) => ({ soundOn: !state.soundOn })),

  setContextMenu: (contextMenu) => set({ contextMenu }),
  setDropTarget: (dropTarget) =>
    set((state) => {
      const cur = state.dropTarget
      if (cur === dropTarget) return state
      if (cur && dropTarget && cur.id === dropTarget.id && cur.valid === dropTarget.valid) {
        return state
      }
      return { dropTarget }
    }),
  setShortcutHelp: (showShortcutHelp) => set({ showShortcutHelp }),
  setShowGallery: (showGallery) => set({ showGallery }),
  setShowAchievements: (showAchievements) => set({ showAchievements }),
  setShowCreateMission: (showCreateMission) => set({ showCreateMission }),
  setCustomMission: (customMission) =>
    set(
      customMission
        ? { customMission, activeMissionId: 'custom', mode: 'challenge' as const }
        : { customMission: null },
    ),

  saveSlot: (name) =>
    set((state) => {
      slotSeq += 1
      const now = Date.now()
      const slot: GallerySlot = {
        id: `s-${now.toString(36)}-${slotSeq}`,
        name: name.trim() || `설계 ${state.slots.length + 1}`,
        snapshot: toSnapshot(
          state.nodes,
          state.edges,
          state.activeMissionId,
          state.securityGroups,
        ),
        createdAt: now,
        updatedAt: now,
      }
      return { slots: [slot, ...state.slots] }
    }),

  loadSlot: (id) => {
    const slot = useGraphStore.getState().slots.find((s) => s.id === id)
    if (!slot) return
    // Re-sanitize on load: a slot persisted under an older schema (or hand-
    // edited localStorage) can't inject anything the share path wouldn't.
    const clean = sanitizeSnapshot(slot.snapshot)
    if (!clean) {
      set({ notice: { text: '슬롯을 불러올 수 없습니다 (손상된 데이터).', kind: 'error' } })
      return
    }
    bumpNodeSeq(clean.nodes)
    bumpSgSeq(clean.securityGroups)
    set({
      nodes: normalizeContainment(clean.nodes),
      edges: clean.edges,
      securityGroups: clean.securityGroups,
      selectedNodeId: null,
      activeMissionId: clean.missionId ?? null,
      ...(clean.missionId ? { mode: 'challenge' as const } : {}),
      simulation: null,
      showGallery: false,
      notice: { text: `"${slot.name}" 설계를 불러왔습니다.`, kind: 'info' },
    })
  },

  deleteSlot: (id) =>
    set((state) => ({ slots: state.slots.filter((s) => s.id !== id) })),

  renameSlot: (id, name) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.id === id ? { ...s, name: name.trim() || s.name, updatedAt: Date.now() } : s,
      ),
    })),

  markBadges: (ids) =>
    set((state) => {
      const next = new Set(state.earnedBadges)
      let changed = false
      for (const id of ids) if (!next.has(id)) { next.add(id); changed = true }
      return changed ? { earnedBadges: [...next] } : state
    }),

  reset: () =>
    set({
      nodes: initialNodes,
      edges: [],
      securityGroups: [],
      highlightSgId: null,
      selectedNodeId: null,
      activeMissionId: null,
      notice: null,
      mobileDrawers: { palette: false, inspector: false, missions: false },
      simulation: null,
      contextMenu: null,
      dropTarget: null,
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
          // Gallery slots (ADR 0033) + announced badges (ADR 0032). New fields
          // stay backward-compatible: an older payload without them simply
          // keeps the `[]` defaults via the merge below (no version bump, so
          // existing saved designs are never discarded).
          slots: s.slots,
          earnedBadges: s.earnedBadges,
          soundOn: s.soundOn,
          // Custom mission (ADR 0065) persists so a loaded #m= link survives refresh.
          customMission: s.customMission,
          // Security groups (ADR 0059). Persisted alongside the graph; an older
          // payload without it (SGs as nodes+edges) is migrated by the sanitizer
          // in `merge` below, which folds legacy sg nodes into this collection.
          securityGroups: s.securityGroups,
        }),
        // Rehydrate through the same whitelist as shared URLs (ADR 0023). If
        // the stored graph fails sanitation we keep it as-is — local data is
        // trusted more than a foreign URL, and dropping a design is worse.
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Record<string, unknown>
          const merged = { ...current, ...p } as GraphState
          if (Array.isArray(p.nodes)) {
            const clean = sanitizeSnapshot({
              v: 2,
              nodes: p.nodes,
              edges: p.edges ?? [],
              sg: p.securityGroups,
            })
            if (clean) {
              merged.nodes = normalizeContainment(clean.nodes)
              merged.edges = clean.edges
              merged.securityGroups = clean.securityGroups
            }
          }
          return merged
        },
        onRehydrateStorage: () => (state) => {
          if (state) {
            bumpNodeSeq(state.nodes)
            bumpSgSeq(state.securityGroups)
          }
        },
      },
    ),
    {
      // Undo/redo tracks the design graph + SG collection (ADR 0023/0059) —
      // creating, editing, or assigning an SG is one undoable step. Assignment
      // itself mutates node.data.config, already covered by `nodes`.
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges, securityGroups: s.securityGroups }),
      equality: (a, b) =>
        a.nodes === b.nodes && a.edges === b.edges && a.securityGroups === b.securityGroups,
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
