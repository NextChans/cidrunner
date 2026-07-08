import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type XYPosition,
  type ReactFlowInstance,
} from '@xyflow/react'
import { Map as MapIcon } from 'lucide-react'
import { ResourceNode } from './nodes/ResourceNode'
import { TrafficEdge } from './edges/TrafficEdge'
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
  const stopSimulation = useGraphStore((s) => s.stopSimulation)
  const simulation = useGraphStore((s) => s.simulation)
  const showMiniMap = useGraphStore((s) => s.showMiniMap)
  const toggleMiniMap = useGraphStore((s) => s.toggleMiniMap)

  const nodeTypes = useMemo<NodeTypes>(() => ({ resource: ResourceNode }), [])
  const edgeTypes = useMemo<EdgeTypes>(() => ({ traffic: TrafficEdge }), [])

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
      if (!source || !target || source.id === target.id) return
      if (!canConnect(source.data.type, target.data.type)) {
        setNotice(
          `${getResource(source.data.type).label} → ${getResource(target.data.type).label} 연결은 허용되지 않습니다.`,
        )
        return
      }
      // Replication link (RDS → RDS): a replica has exactly one source.
      if (source.data.type === 'rds' && target.data.type === 'rds') {
        const hasSource = edges.some(
          (e) =>
            e.target === target.id &&
            nodes.find((n) => n.id === e.source)?.data.type === 'rds',
        )
        if (hasSource) {
          setNotice('이 RDS는 이미 복제 소스가 있습니다. 복제본의 소스는 1개입니다.')
          return
        }
      }
      stopSimulation()
      setEdges(addEdge({ ...connection, type: 'traffic' }, edges))
    },
    [nodes, edges, setEdges, setNotice, stopSimulation],
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
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        fitView
        proOptions={{ hideAttribution: false }}
        defaultEdgeOptions={{ type: 'traffic', animated: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls className="!bg-surface-raised !text-slate-200" />
        {showMiniMap && (
          <MiniMap
            pannable
            zoomable
            className="!bg-surface-raised"
            nodeColor="#334155"
            maskColor="rgba(15, 23, 42, 0.6)"
          />
        )}
        <Panel position="top-right">
          <button
            type="button"
            onClick={() => toggleMiniMap()}
            title={showMiniMap ? '미니맵 숨기기' : '미니맵 표시'}
            className={
              'rounded-md border border-surface-border p-1.5 transition-colors ' +
              (showMiniMap
                ? 'bg-accent text-slate-900'
                : 'bg-surface-raised text-slate-400 hover:text-slate-200')
            }
          >
            <MapIcon size={14} />
          </button>
        </Panel>
      </ReactFlow>

      {notice && (
        <div
          role="alert"
          className={
            'pointer-events-none absolute left-1/2 top-4 z-10 max-w-[90%] -translate-x-1/2 rounded-md border px-4 py-2 text-center text-xs shadow-lg ' +
            (notice.kind === 'info'
              ? 'border-accent/60 bg-emerald-950/90 text-emerald-200'
              : 'border-rose-800/70 bg-rose-950/90 text-rose-200')
          }
        >
          {notice.text}
        </div>
      )}

      {simulation && (
        <div
          role="status"
          className={
            'absolute left-1/2 top-4 z-10 max-w-[92%] -translate-x-1/2 rounded-md border px-4 py-2 text-xs shadow-lg ' +
            (simulation.ok
              ? 'border-accent/60 bg-emerald-950/90 text-emerald-200'
              : 'border-rose-800/70 bg-rose-950/90 text-rose-200')
          }
        >
          <div className="flex items-center justify-center gap-2">
            <span>{simulation.ok ? '✅' : '⛔'}</span>
            <span>{simulation.message}</span>
            <button
              type="button"
              onClick={() => stopSimulation()}
              className="ml-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
            >
              닫기
            </button>
          </div>
          {simulation.flows.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5 text-left">
              {simulation.flows.map((flow, i) => (
                <li key={flow.entryId} className="flex items-start gap-1.5">
                  <span>{flow.ok ? '🟢' : '🔴'}</span>
                  <span>
                    {i + 1}. {flow.label}
                    {flow.ok ? ' — 도달' : ` — ${flow.message}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
