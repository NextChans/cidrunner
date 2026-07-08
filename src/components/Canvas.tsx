import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeTypes,
} from '@xyflow/react'
import { ResourceNode } from './nodes/ResourceNode'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'

export function Canvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const setSelected = useGraphStore((s) => s.setSelected)

  const nodeTypes = useMemo<NodeTypes>(() => ({ resource: ResourceNode }), [])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, nodes) as ResourceNodeType[])
    },
    [nodes, setNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges))
    },
    [edges, setEdges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(addEdge({ ...connection, animated: true }, edges))
    },
    [edges, setEdges],
  )

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        fitView
        proOptions={{ hideAttribution: false }}
        defaultEdgeOptions={{ animated: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls className="!bg-surface-raised !text-slate-200" />
        <MiniMap
          pannable
          zoomable
          className="!bg-surface-raised"
          nodeColor="#334155"
          maskColor="rgba(15, 23, 42, 0.6)"
        />
      </ReactFlow>
    </div>
  )
}
