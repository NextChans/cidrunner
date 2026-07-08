import { create } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import { getResource, type ResourceType } from '@/resources'

export type Mode = 'free' | 'challenge'

export interface NodeData {
  type: ResourceType
  label: string
  config: Record<string, unknown>
  [key: string]: unknown
}

export type ResourceNodeType = Node<NodeData>

interface GraphState {
  mode: Mode
  nodes: ResourceNodeType[]
  edges: Edge[]
  selectedNodeId: string | null
  activeMissionId: string | null

  setMode: (mode: Mode) => void
  addNode: (type: ResourceType) => void
  removeNode: (id: string) => void
  setNodes: (nodes: ResourceNodeType[]) => void
  setEdges: (edges: Edge[]) => void
  setSelected: (id: string | null) => void
  setActiveMission: (id: string | null) => void
  reset: () => void
}

/** Seed graph: a VPC container with a Subnet and an EC2 instance inside. */
const initialNodes: ResourceNodeType[] = [
  {
    id: 'vpc-1',
    type: 'resource',
    position: { x: 80, y: 60 },
    style: { width: 420, height: 300 },
    data: { type: 'vpc', label: 'VPC', config: { cidr_block: '10.0.0.0/16' } },
  },
  {
    id: 'subnet-1',
    type: 'resource',
    position: { x: 40, y: 80 },
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
    position: { x: 220, y: 80 },
    parentId: 'vpc-1',
    extent: 'parent',
    data: { type: 'ec2', label: 'EC2 Instance', config: { instance_type: 't3.micro' } },
  },
]

// Monotonic counter so newly-added nodes never collide with seeded ids.
let nodeSeq = initialNodes.length

export const useGraphStore = create<GraphState>((set) => ({
  mode: 'free',
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  activeMissionId: null,

  setMode: (mode) => set({ mode }),

  addNode: (type) =>
    set((state) => {
      const meta = getResource(type)
      nodeSeq += 1
      const id = `${type}-${nodeSeq}`
      // Fan new nodes out slightly so they don't stack on one spot.
      const offset = (state.nodes.length % 6) * 28
      const node: ResourceNodeType = {
        id,
        type: 'resource',
        position: { x: 560 + offset, y: 120 + offset },
        data: { type, label: meta.label, config: { ...meta.defaults } },
      }
      return { nodes: [...state.nodes, node], selectedNodeId: id }
    }),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id && n.parentId !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelected: (selectedNodeId) => set({ selectedNodeId }),
  setActiveMission: (activeMissionId) => set({ activeMissionId }),

  reset: () =>
    set({ nodes: initialNodes, edges: [], selectedNodeId: null, activeMissionId: null }),
}))
