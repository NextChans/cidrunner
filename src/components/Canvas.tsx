import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeTypes,
  type XYPosition,
  type ReactFlowInstance,
} from '@xyflow/react'
import { ResourceNode } from './nodes/ResourceNode'
import { getResource, resources, type ResourceType } from '@/resources'
import { canConnect, canContain, canBeTopLevel, isContainer, requiredParentLabel } from '@/graph/rules'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'

const DND_MIME = 'application/cidrunner'

type RfInstance = ReactFlowInstance<ResourceNodeType>

/**
 * Finds the innermost container node under `point` that is allowed to hold a
 * `childType` node. Returns the container id and its absolute position so the
 * caller can compute a parent-relative drop position.
 */
function findDropParent(rf: RfInstance, point: XYPosition, childType: ResourceType) {
  const candidates = rf
    .getNodes()
    .filter(
      (n) =>
        isContainer(n.data.type) && canContain(n.data.type, childType),
    )
    .map((n) => {
      const internal = rf.getInternalNode(n.id)
      const absPos = internal?.internals.positionAbsolute ?? n.position
      const width = internal?.measured?.width ?? 0
      const height = internal?.measured?.height ?? 0
      return { id: n.id, absPos, width, height, area: width * height }
    })
    .filter(
      (c) =>
        point.x >= c.absPos.x &&
        point.x <= c.absPos.x + c.width &&
        point.y >= c.absPos.y &&
        point.y <= c.absPos.y + c.height,
    )
    .sort((a, b) => a.area - b.area)

  return candidates[0] ?? null
}

export function Canvas() {
  const rf = useReactFlow<ResourceNodeType>()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const setSelected = useGraphStore((s) => s.setSelected)
  const addNodeAt = useGraphStore((s) => s.addNodeAt)
  const notice = useGraphStore((s) => s.notice)
  const setNotice = useGraphStore((s) => s.setNotice)

  const nodeTypes = useMemo<NodeTypes>(() => ({ resource: ResourceNode }), [])

  // Auto-dismiss the transient notice.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3200)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

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
      const source = nodes.find((n) => n.id === connection.source)
      const target = nodes.find((n) => n.id === connection.target)
      if (!source || !target) return
      if (!canConnect(source.data.type, target.data.type)) {
        setNotice(
          `${getResource(source.data.type).label} → ${getResource(target.data.type).label} 연결은 허용되지 않습니다.`,
        )
        return
      }
      setEdges(addEdge({ ...connection, animated: true }, edges))
    },
    [nodes, edges, setEdges, setNotice],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData(DND_MIME) as ResourceType
      if (!type || !(type in resources)) return

      const point = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const parent = findDropParent(rf, point, type)

      if (parent) {
        addNodeAt(
          type,
          { x: point.x - parent.absPos.x, y: point.y - parent.absPos.y },
          parent.id,
        )
      } else if (canBeTopLevel(type)) {
        addNodeAt(type, point)
      } else {
        setNotice(
          `${getResource(type).label}은(는) ${requiredParentLabel(type)} 안에 놓아야 합니다.`,
        )
      }
    },
    [rf, addNodeAt, setNotice],
  )

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
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

      {notice && (
        <div
          role="alert"
          className="pointer-events-none absolute left-1/2 top-4 z-10 max-w-[90%] -translate-x-1/2 rounded-md border border-rose-800/70 bg-rose-950/90 px-4 py-2 text-center text-xs text-rose-200 shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  )
}
