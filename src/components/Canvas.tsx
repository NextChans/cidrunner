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
import { DerivedEdge } from './edges/DerivedEdge'
import { getResource, resources, type ResourceType } from '@/resources'
import { canConnect, canContain, canBeTopLevel, isContainer, requiredParentLabel } from '@/graph/rules'
import { derivedEdges } from '@/graph/derived'
import { estimateMonthlyCost } from '@/graph/cost'
import { graphAzs, applyAzFault } from '@/graph/chaos'
import { wellArchitectedGrade } from '@/graph/grade'
import { getMission } from '@/missions'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'

const DND_MIME = 'application/cidrunner'

type RfInstance = ReactFlowInstance<ResourceNodeType>

/**
 * Finds the innermost container node under `point` that is allowed to hold a
 * `childType` node. Returns the container id and its absolute position so the
 * caller can compute a parent-relative drop position. `excludeIds` skips the
 * dragged node and its own descendants (a node can't be nested into itself).
 */
function findDropParent(
  rf: RfInstance,
  point: XYPosition,
  childType: ResourceType,
  excludeIds?: ReadonlySet<string>,
) {
  const candidates = rf
    .getNodes()
    .filter(
      (n) =>
        isContainer(n.data.type) &&
        canContain(n.data.type, childType) &&
        !excludeIds?.has(n.id),
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

/** The dragged node's center in flow coords plus its subtree (invalid targets). */
function dragContext(rf: RfInstance, node: ResourceNodeType) {
  const internal = rf.getInternalNode(node.id)
  const abs = internal?.internals.positionAbsolute ?? node.position
  const width = internal?.measured?.width ?? 0
  const height = internal?.measured?.height ?? 0
  const center = { x: abs.x + width / 2, y: abs.y + height / 2 }

  const all = rf.getNodes()
  const exclude = new Set<string>([node.id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of all) {
      if (n.parentId && exclude.has(n.parentId) && !exclude.has(n.id)) {
        exclude.add(n.id)
        grew = true
      }
    }
  }
  return { center, exclude }
}

/**
 * Innermost container under `point`, regardless of whether the rules allow the
 * nesting — so an invalid hover can still be highlighted red. `valid` is true
 * only when `childType` may nest inside it. The dragged subtree is excluded.
 */
function containerUnder(
  rf: RfInstance,
  point: XYPosition,
  childType: ResourceType,
  excludeIds: ReadonlySet<string>,
): { id: string; valid: boolean } | null {
  const hit = rf
    .getNodes()
    .filter((n) => isContainer(n.data.type) && !excludeIds.has(n.id))
    .map((n) => {
      const internal = rf.getInternalNode(n.id)
      const absPos = internal?.internals.positionAbsolute ?? n.position
      const width = internal?.measured?.width ?? 0
      const height = internal?.measured?.height ?? 0
      return { id: n.id, type: n.data.type, absPos, width, height, area: width * height }
    })
    .filter(
      (c) =>
        point.x >= c.absPos.x &&
        point.x <= c.absPos.x + c.width &&
        point.y >= c.absPos.y &&
        point.y <= c.absPos.y + c.height,
    )
    .sort((a, b) => a.area - b.area)[0]
  if (!hit) return null
  return { id: hit.id, valid: canContain(hit.type, childType) }
}

export function Canvas() {
  const rf = useReactFlow<ResourceNodeType>()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const securityGroups = useGraphStore((s) => s.securityGroups)
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
  const setContextMenu = useGraphStore((s) => s.setContextMenu)
  const attachToParent = useGraphStore((s) => s.attachToParent)
  const setDropTarget = useGraphStore((s) => s.setDropTarget)
  const activeMissionId = useGraphStore((s) => s.activeMissionId)
  const chaosAz = useGraphStore((s) => s.chaosAz)
  const setChaos = useGraphStore((s) => s.setChaos)

  // Budget mode (ADR 0051): a live monthly-cost estimate for the whole graph,
  // gauged against the active mission's optional budget target.
  const monthlyCost = useMemo(() => estimateMonthlyCost(nodes), [nodes])
  const budget = activeMissionId ? getMission(activeMissionId)?.budget : undefined
  const overBudget = budget !== undefined && monthlyCost > budget

  // Chaos mode (ADR 0052): the AZs present in the graph, offered as fault buttons.
  const azs = useMemo(() => graphAzs(nodes), [nodes])

  // Well-Architected grade (ADR 0054): live score across 4 pillars.
  const grade = useMemo(
    () => wellArchitectedGrade(nodes, edges, securityGroups),
    [nodes, edges, securityGroups],
  )

  const nodeTypes = useMemo<NodeTypes>(() => ({ resource: ResourceNode }), [])
  const edgeTypes = useMemo<EdgeTypes>(
    () => ({ traffic: TrafficEdge, derived: DerivedEdge }),
    [],
  )

  // Engine-owned derived edges (ADR 0043) are rendered but never stored: merge
  // them in for display only, so onEdgesChange keeps operating on user edges.
  // During chaos (ADR 0053), render the AZ-fault's rewired edges so traffic
  // visually follows a promoted replica instead of pointing at the dead master.
  const renderedEdges = useMemo(() => {
    const base = chaosAz ? applyAzFault(nodes, edges, chaosAz).edges : edges
    return [...base, ...derivedEdges(nodes)]
  }, [chaosAz, edges, nodes])

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
      let conn = connection
      let source = nodes.find((n) => n.id === conn.source)
      let target = nodes.find((n) => n.id === conn.target)
      if (!source || !target || source.id === target.id) return
      // Auto-orient (ADR 0060): nodes like ALB carry BOTH a source and a target
      // handle (ALB forwards to EC2 *and* receives from CloudFront/ACM/WAF), so
      // dragging from the handle nearest the peer often produces the reverse of
      // what the user means. If the drawn direction is illegal but the opposite
      // is legal, silently flip it — the tiers only connect one way.
      if (
        !canConnect(source.data.type, target.data.type) &&
        canConnect(target.data.type, source.data.type)
      ) {
        conn = {
          ...conn,
          source: connection.target,
          target: connection.source,
          sourceHandle: connection.targetHandle ?? null,
          targetHandle: connection.sourceHandle ?? null,
        }
        ;[source, target] = [target, source]
      }
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
      setEdges(addEdge({ ...conn, type: 'traffic' }, edges))
    },
    [nodes, edges, setEdges, setNotice, stopSimulation],
  )

  // Live drop-target highlight while dragging (ADR 0040): mark the innermost
  // container under the node, valid or not, so the node renderer can tint it.
  const onNodeDrag = useCallback(
    (_: MouseEvent | TouchEvent, node: ResourceNodeType) => {
      const { center, exclude } = dragContext(rf, node)
      setDropTarget(containerUnder(rf, center, node.data.type, exclude))
    },
    [rf, setDropTarget],
  )

  // Drop-onto-parent for existing nodes (ADR 0038): on release, nest the node
  // into the innermost container under its center if the rules allow it.
  const onNodeDragStop = useCallback(
    (_: MouseEvent | TouchEvent, node: ResourceNodeType) => {
      const { center, exclude } = dragContext(rf, node)
      const parent = findDropParent(rf, center, node.data.type, exclude)
      if (parent && parent.id !== node.parentId) {
        attachToParent(node.id, parent.id)
      }
      setDropTarget(null)
    },
    [rf, attachToParent, setDropTarget],
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
        edges={renderedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        onNodeContextMenu={(e, node) => {
          e.preventDefault()
          setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY })
        }}
        onPaneContextMenu={() => setContextMenu(null)}
        fitView
        // Culls off-viewport nodes/edges so large graphs (100+ nodes) stay
        // responsive on pan/zoom (ADR 0029).
        onlyRenderVisibleElements
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
        <Panel position="top-left">
          <div className="flex flex-col gap-1.5">
            <div
              title="예상 월 비용 (대략치)"
              className={
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-lg ' +
                (budget === undefined
                  ? 'border-surface-border bg-surface-raised text-slate-300'
                  : overBudget
                    ? 'border-rose-700/70 bg-rose-950/90 text-rose-200'
                    : 'border-accent/60 bg-emerald-950/90 text-emerald-200')
              }
            >
              <span>💸</span>
              <span className="tabular-nums">${monthlyCost}/월</span>
              {budget !== undefined && (
                <span className="tabular-nums opacity-80">
                  {' '}
                  / 예산 ${budget}
                  {overBudget ? ' ⚠️' : ' ✓'}
                </span>
              )}
            </div>
            {/* Well-Architected grade (ADR 0054): live letter + 4 pillar scores. */}
            <div
              title={`Well-Architected 등급 (종합 ${grade.overall})\n🔒 보안 ${grade.pillars.security} · 🛡 신뢰성 ${grade.pillars.reliability} · 💰 비용 ${grade.pillars.cost} · ⚡ 성능 ${grade.pillars.performance}`}
              className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-raised px-2.5 py-1 text-xs shadow-lg"
            >
              <span
                className={
                  'flex h-5 w-5 items-center justify-center rounded font-bold ' +
                  (grade.overall >= 75
                    ? 'bg-emerald-500 text-slate-900'
                    : grade.overall >= 60
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-rose-500 text-white')
                }
              >
                {grade.letter}
              </span>
              <span className="tabular-nums text-slate-400">
                🔒{grade.pillars.security} 🛡{grade.pillars.reliability} 💰
                {grade.pillars.cost} ⚡{grade.pillars.performance}
              </span>
            </div>
          </div>
        </Panel>
        {azs.length > 0 && (
          <Panel position="bottom-center">
            <div className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-raised/95 px-2 py-1 text-xs shadow-lg">
              <span className="text-slate-400" title="장애 주입 — AZ를 다운시켜 설계가 버티는지 확인">
                ⚡ 장애
              </span>
              {azs.map((az) => (
                <button
                  key={az}
                  type="button"
                  onClick={() => setChaos(chaosAz === az ? null : az)}
                  className={
                    'rounded px-1.5 py-0.5 font-medium transition-colors ' +
                    (chaosAz === az
                      ? 'bg-rose-600 text-white'
                      : 'bg-surface text-slate-300 hover:text-slate-100')
                  }
                >
                  AZ-{az}
                </button>
              ))}
              {chaosAz && (
                <button
                  type="button"
                  onClick={() => setChaos(null)}
                  className="rounded px-1.5 py-0.5 text-slate-400 hover:text-slate-100"
                >
                  복구
                </button>
              )}
            </div>
          </Panel>
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
