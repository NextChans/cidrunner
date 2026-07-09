import type { Edge } from '@xyflow/react'
import { getResource } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { ResourceType } from '@/resources'

/**
 * Traffic simulation (Phase 3, extended to multi-flow — ADR 0018 — and to a
 * backtracking path search — ADR 0047 / QA-002). Pressing Start traces a request
 * from EVERY entry point (each ALB, API Gateway, Lambda, … with no inbound
 * traffic) along the traffic edges to a data sink (RDS/S3/…). Instead of greedily
 * committing to the first outgoing edge, the tracer performs a depth-first search
 * with backtracking: a flow succeeds if *any* path from the entry reaches a sink,
 * so a completed branch is no longer masked by an incomplete sibling drawn first.
 *
 * Edges whose source is a Security Group are *attachments*, not traffic, and are
 * ignored here (ADR 0017), as are CloudWatch monitoring links and RDS → RDS
 * replication links (ADR 0019).
 */

/** Seconds per hop — drives particle stagger and arrival pulses. */
export const HOP_SECONDS = 0.45

/** One traced request, from one entry. */
export interface SimFlow {
  entryId: string
  ok: boolean
  /** Node ids on the traced path, in visit order (a successful path when ok). */
  pathNodeIds: string[]
  /** Edge ids on the traced path, in visit order. */
  pathEdgeIds: string[]
  /** The node where the path broke, if it failed. */
  blockedNodeId: string | null
  /** Player-facing line, e.g. `ALB → EC2 Instance → RDS Database`. */
  label: string
  message: string
}

export interface SimResult {
  ok: boolean
  flows: SimFlow[]
  /** Aggregate player-facing summary. */
  message: string
  /** Nodes on *some* live entry→sink path (green highlight) — not just the one
   * route per flow, so a fanned-out balancer lights every reachable branch. */
  pathNodeIds: string[]
  /** Edges on some live entry→sink path (the 'ok' edges). */
  pathEdgeIds: string[]
  /** Nodes where traffic dead-ends: per-flow blocks + fan-out targets that can't
   * reach a sink (red highlight). A node on a green path is never listed. */
  blockedNodeIds: string[]
  /** edge id → hop distance from the nearest entry (particle stagger). */
  edgeHops: Record<string, number>
  /** node id → seconds until the request reaches it (arrival pulse). */
  arrivals: Record<string, number>
  /**
   * Load-balancer fan-out (ADR 0048): for every reachable, unblocked ALB, each of
   * its outgoing traffic edges gets a round-robin slot so the renderer can animate
   * the balancer distributing across all registered targets — not just the one on
   * the traced success path.
   */
  fanout: Record<string, { index: number; total: number }>
  /**
   * Per-highlighted-edge outcome (ADR 0049): `'ok'` when the edge lies on a
   * successful flow, `'blocked'` when it only lies on a failed one. Drives the
   * green vs. red in/out direction effect on traffic edges.
   */
  edgeStatus: Record<string, 'ok' | 'blocked'>
  /**
   * Replication flow (ADR 0019 + F3): read-replica node id → seconds until
   * replicated data reaches it (its primary's arrival + one hop). Present only
   * when the primary RDS is on a live request path, so the RDS → RDS edge and
   * the replica node animate an indigo replication pulse distinct from the green
   * request traffic.
   */
  replicaArrivals: Record<string, number>
  /**
   * Chaos mode (ADR 0052): node ids knocked out by an injected fault (e.g. an AZ
   * failure). They are excluded from the trace and rendered dimmed. Empty on a
   * normal run.
   */
  deadNodeIds: string[]
  /**
   * Chaos mode (ADR 0053): Multi-AZ RDS instances that rode out the AZ failure
   * via automatic failover to their standby — same endpoint, no promotion. Shown
   * with a ⚡ failover badge so a surviving DB inside a downed AZ reads clearly.
   */
  failoverNodeIds: string[]
  /**
   * Chaos mode (ADR 0053): read replicas promoted to primary because their
   * single-AZ master died with the AZ; request traffic that targeted the dead
   * master is rerouted here. Shown with a promotion badge.
   */
  promotedNodeIds: string[]
}

/** Types that terminate a successful request (the "DB / storage" tier). */
const SINKS: ReadonlySet<ResourceType> = new Set<ResourceType>([
  'rds',
  's3',
  'dynamodb',
  'elasticache',
  'efs',
])

/** Types that can originate a request when nothing feeds them. */
const ENTRY_CAPABLE: ReadonlySet<ResourceType> = new Set<ResourceType>([
  'route53',
  'cloudfront',
  'apigw',
  'alb',
  'lambda',
  'ecs',
  'eks',
  // A Kinesis stream that nothing feeds is the head of a data pipeline
  // (ingestion → Lambda consumer → sink) — ADR 0035.
  'kinesis',
])

/** Node types that distribute inbound traffic across many targets (fan-out). */
const BALANCERS: ReadonlySet<ResourceType> = new Set<ResourceType>(['alb'])

/** Walks the parent chain to the enclosing VPC, if any. */
function vpcOf(
  node: ResourceNodeType,
  byId: Map<string, ResourceNodeType>,
): ResourceNodeType | undefined {
  let cur = node.parentId ? byId.get(node.parentId) : undefined
  while (cur) {
    if (cur.data.type === 'vpc') return cur
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return undefined
}

/**
 * Internet ingress gate (ADR 0039). An internet-facing ALB (`internal !== true`)
 * placed inside a VPC can only receive traffic if that VPC has an Internet
 * Gateway attached and at least one public subnet for the ALB to live in —
 * modeling `인터넷 → IGW → public subnet → ALB`. Returns a player-facing block
 * message, or `null` when ingress is satisfied (or not applicable).
 *
 * A loose ALB with no enclosing VPC is exempt: there is no VPC topology to
 * evaluate, so the tracer stays as lenient as before (no regression).
 */
function internetIngressBlock(
  node: ResourceNodeType,
  byId: Map<string, ResourceNodeType>,
  nodes: ResourceNodeType[],
): string | null {
  if (node.data.type !== 'alb' || node.data.config.internal === true) return null
  const vpc = vpcOf(node, byId)
  if (!vpc) return null
  const hasIgw = nodes.some(
    (n) => n.data.type === 'igw' && vpcOf(n, byId)?.id === vpc.id,
  )
  if (!hasIgw) {
    return '인터넷 페이싱 ALB인데 VPC에 Internet Gateway가 없습니다. IGW를 VPC에 추가하세요.'
  }
  const hasPublicSubnet = nodes.some(
    (n) =>
      n.data.type === 'subnet' &&
      vpcOf(n, byId)?.id === vpc.id &&
      n.data.config.public === true,
  )
  if (!hasPublicSubnet) {
    return '인터넷 페이싱 ALB가 위치할 퍼블릭 Subnet이 없습니다.'
  }
  return null
}

function blockedMessage(type: ResourceType): string {
  switch (type) {
    case 'route53':
      return 'Route 53 레코드가 가리킬 대상(CloudFront/ALB)이 없습니다.'
    case 'cloudfront':
      return 'CloudFront에 오리진(ALB/S3/API GW)이 연결되어 있지 않습니다.'
    case 'apigw':
      return 'API Gateway가 Lambda에 연결되어 있지 않습니다.'
    case 'alb':
      return '로드 밸런서에서 대상(EC2/Lambda)으로 가는 연결이 없습니다.'
    case 'ec2':
      return 'EC2에서 데이터베이스나 스토리지로 가는 경로가 없습니다.'
    case 'lambda':
      return 'Lambda에서 데이터베이스나 스토리지로 가는 경로가 없습니다.'
    case 'ecs':
    case 'eks':
      return '컨테이너에서 데이터베이스나 스토리지로 가는 경로가 없습니다.'
    case 'sqs':
      return '큐를 소비할 Lambda가 연결되어 있지 않습니다.'
    case 'sns':
      return 'SNS 토픽을 구독하는 대상(SQS/Lambda)이 없습니다.'
    case 'kinesis':
      return '스트림을 소비할 Lambda가 연결되어 있지 않습니다.'
    default:
      return `${getResource(type).label}에서 경로가 끊겼습니다.`
  }
}

/**
 * Traces one request from `entry` with a depth-first, backtracking search. The
 * first path that reaches a sink wins (edges are tried in graph order, so the
 * result is deterministic). If no path reaches a sink, the deepest attempted
 * path is reported so the block message still points at a meaningful dead end.
 */
function traceFlow(
  entry: ResourceNodeType,
  byId: Map<string, ResourceNodeType>,
  trafficEdges: Edge[],
  ingressBlock: (node: ResourceNodeType) => string | null,
): SimFlow {
  // Reachability search: a node is only expanded once (its "can I reach a sink"
  // answer does not depend on how we arrived), which keeps the walk O(V+E) and
  // naturally terminates on cycles. nodePath/edgePath follow the call stack, so a
  // sink hit yields a valid simple path.
  const visited = new Set<string>()
  const nodePath: string[] = []
  const edgePath: string[] = []

  let success: { nodePath: string[]; edgePath: string[] } | null = null
  let bestFail:
    | { nodePath: string[]; edgePath: string[]; blockedNodeId: string; message: string }
    | null = null

  const recordFail = (blockedNodeId: string, message: string) => {
    if (!bestFail || nodePath.length > bestFail.nodePath.length) {
      bestFail = { nodePath: [...nodePath], edgePath: [...edgePath], blockedNodeId, message }
    }
  }

  const dfs = (node: ResourceNodeType): boolean => {
    nodePath.push(node.id)
    visited.add(node.id)

    // Internet ingress gate: an internet-facing ALB without IGW + public subnet
    // cannot be reached from the internet, so no path through it can succeed.
    const ingressMsg = ingressBlock(node)
    if (ingressMsg) {
      recordFail(node.id, ingressMsg)
      nodePath.pop()
      return false
    }

    if (SINKS.has(node.data.type)) {
      success = { nodePath: [...nodePath], edgePath: [...edgePath] }
      nodePath.pop()
      return true
    }

    let advanced = false
    for (const edge of trafficEdges) {
      if (edge.source !== node.id) continue
      const next = byId.get(edge.target)
      if (!next || visited.has(next.id)) continue
      advanced = true
      edgePath.push(edge.id)
      const found = dfs(next)
      edgePath.pop()
      if (found) {
        nodePath.pop()
        return true
      }
    }

    // A dead end: no unvisited outgoing edge led to a sink from here.
    if (!advanced) recordFail(node.id, blockedMessage(node.data.type))
    nodePath.pop()
    return false
  }

  dfs(entry)

  const labelOf = (ids: string[]) =>
    ids.map((id) => byId.get(id)?.data.label ?? id).join(' → ')

  if (success) {
    const s: { nodePath: string[]; edgePath: string[] } = success
    return {
      entryId: entry.id,
      ok: true,
      pathNodeIds: s.nodePath,
      pathEdgeIds: s.edgePath,
      blockedNodeId: null,
      label: labelOf(s.nodePath),
      message: '도달',
    }
  }

  // No path reached a sink. Surface the deepest attempt (falls back to the entry
  // itself when it had nowhere to go).
  const fail: {
    nodePath: string[]
    edgePath: string[]
    blockedNodeId: string
    message: string
  } =
    bestFail ?? {
      nodePath: [entry.id],
      edgePath: [],
      blockedNodeId: entry.id,
      message: blockedMessage(entry.data.type),
    }
  return {
    entryId: entry.id,
    ok: false,
    pathNodeIds: fail.nodePath,
    pathEdgeIds: fail.edgePath,
    blockedNodeId: fail.blockedNodeId,
    label: labelOf(fail.nodePath),
    message: fail.message,
  }
}

/**
 * Every distinct sink reachable from `entry`, with a shortest representative
 * path to each (BFS + parent pointers). This is what lets the banner enumerate
 * ALL destinations — an entry that fans out to several sinks (CloudFront → S3
 * *and* → ALB → … → RDS; a producer Lambda → S3 *and* → SQS → … → DynamoDB)
 * yields one route per sink, not just the first one the DFS happened to pick.
 * Ingress-blocked ALBs are reached but not expanded (traffic can't pass).
 */
function tracePathsToSinks(
  entry: ResourceNodeType,
  byId: Map<string, ResourceNodeType>,
  trafficEdges: Edge[],
  ingressBlock: (node: ResourceNodeType) => string | null,
): { nodePath: string[]; edgePath: string[] }[] {
  const parentOf = new Map<string, { node: string; edge: string }>()
  const reached = new Set<string>([entry.id])
  const queue: string[] = [entry.id]
  const sinkIds: string[] = []
  while (queue.length) {
    const uid = queue.shift()!
    const u = byId.get(uid)
    if (!u) continue
    if (ingressBlock(u)) continue // reached, but a wall — do not expand
    if (SINKS.has(u.data.type)) {
      sinkIds.push(uid)
      continue // sinks terminate the path
    }
    for (const edge of trafficEdges) {
      if (edge.source !== uid) continue
      const v = edge.target
      if (!byId.has(v) || reached.has(v)) continue
      reached.add(v)
      parentOf.set(v, { node: uid, edge: edge.id })
      queue.push(v)
    }
  }
  return sinkIds.map((sid) => {
    const nodePath: string[] = []
    const edgePath: string[] = []
    let cur: string | undefined = sid
    while (cur !== undefined) {
      nodePath.unshift(cur)
      const p = parentOf.get(cur)
      if (!p) break
      edgePath.unshift(p.edge)
      cur = p.node
    }
    return { nodePath, edgePath }
  })
}

/** Options for {@link simulate}. */
export interface SimOptions {
  /**
   * Chaos mode (ADR 0052): node ids knocked out by an injected fault. They are
   * removed from the graph before tracing, so flows that depended on them fail
   * while redundant designs survive.
   */
  deadNodeIds?: ReadonlySet<string>
  /** Multi-AZ RDS that survived via failover — echoed to the result (ADR 0053). */
  failoverIds?: readonly string[]
  /** Read replicas promoted to primary — echoed to the result (ADR 0053). */
  promotedIds?: readonly string[]
}

/** Runs the simulation over the whole graph: one flow per entry point. */
export function simulate(
  nodes: ResourceNodeType[],
  edges: Edge[],
  opts: SimOptions = {},
): SimResult {
  const dead = opts.deadNodeIds ?? new Set<string>()
  const deadNodeIds = [...dead]
  const failoverNodeIds = [...(opts.failoverIds ?? [])]
  const promotedNodeIds = [...(opts.promotedIds ?? [])]
  // Chaos mode: a downed node is treated as absent — it cannot be an entry, a
  // hop, or a sink, and edges touching it carry nothing.
  if (dead.size) {
    nodes = nodes.filter((n) => !dead.has(n.id))
    edges = edges.filter((e) => !dead.has(e.source) && !dead.has(e.target))
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  // SG edges are attachments, CloudWatch edges are monitoring links, and
  // RDS → RDS edges are replication links (ADR 0019) — none carries request
  // traffic.
  const trafficEdges = edges.filter((e) => {
    const src = byId.get(e.source)?.data.type
    return (
      src !== 'sg' &&
      src !== 'cloudwatch' &&
      !(src === 'rds' && byId.get(e.target)?.data.type === 'rds')
    )
  })

  // Entry = an entry-capable node nothing feeds (a CloudFront-fed ALB is a
  // hop, not its own entry; a Route 53 record starts the journey).
  const entries = nodes.filter(
    (n) =>
      ENTRY_CAPABLE.has(n.data.type) && !trafficEdges.some((e) => e.target === n.id),
  )

  if (entries.length === 0) {
    return {
      ok: false,
      flows: [],
      message:
        '트래픽 진입점이 없습니다. Route 53 / CloudFront / API Gateway / ALB / Lambda를 추가하세요.',
      pathNodeIds: [],
      pathEdgeIds: [],
      blockedNodeIds: [],
      edgeHops: {},
      arrivals: {},
      fanout: {},
      edgeStatus: {},
      replicaArrivals: {},
      deadNodeIds,
      failoverNodeIds,
      promotedNodeIds,
    }
  }

  const ingressBlock = (node: ResourceNodeType) =>
    internetIngressBlock(node, byId, nodes)
  // One flow per (entry, reachable sink) so the banner enumerates every
  // destination; an entry that reaches no sink yields a single failed flow with
  // a block reason (via the DFS tracer).
  const flows: SimFlow[] = []
  for (const entry of entries) {
    const routes = tracePathsToSinks(entry, byId, trafficEdges, ingressBlock)
    if (routes.length === 0) {
      flows.push(traceFlow(entry, byId, trafficEdges, ingressBlock))
      continue
    }
    for (const r of routes) {
      flows.push({
        entryId: entry.id,
        ok: true,
        pathNodeIds: r.nodePath,
        pathEdgeIds: r.edgePath,
        blockedNodeId: null,
        label: r.nodePath.map((id) => byId.get(id)?.data.label ?? id).join(' → '),
        message: '도달',
      })
    }
  }

  // ── Highlight subgraph ──────────────────────────────────────────────────
  // The per-flow trace above yields ONE representative route per entry (used by
  // the banner and by mission checks). For *highlighting*, we light up the full
  // set of live entry→sink paths instead — so a load balancer that fans out to
  // two app servers shows BOTH of their paths to the database, not just the one
  // the DFS happened to pick. Without this, fan-out (ADR 0048) visibly balances
  // across targets while only one downstream branch lit up (ADR 0047/0048
  // follow-up).

  // Forward reachability from entries, recording a hop distance per node and
  // every traversed edge. An ingress-blocked ALB is reached but NOT expanded —
  // traffic can't pass through it, so its downstream stays dark.
  const fdist = new Map<string, number>()
  const traversed: { id: string; u: string; v: string }[] = []
  const queue: ResourceNodeType[] = []
  for (const e of entries) {
    if (!fdist.has(e.id)) {
      fdist.set(e.id, 0)
      queue.push(e)
    }
  }
  while (queue.length) {
    const u = queue.shift()!
    if (ingressBlock(u)) continue
    for (const edge of trafficEdges) {
      if (edge.source !== u.id) continue
      const v = byId.get(edge.target)
      if (!v) continue
      traversed.push({ id: edge.id, u: u.id, v: v.id })
      if (!fdist.has(v.id)) {
        fdist.set(v.id, (fdist.get(u.id) ?? 0) + 1)
        queue.push(v)
      }
    }
  }

  // Backward reachability: nodes that can still reach a sink (reverse traffic
  // edges from every sink node).
  const reachesSink = new Set<string>()
  const rqueue: string[] = []
  for (const n of nodes) {
    if (SINKS.has(n.data.type)) {
      reachesSink.add(n.id)
      rqueue.push(n.id)
    }
  }
  while (rqueue.length) {
    const vId = rqueue.shift()!
    for (const edge of trafficEdges) {
      if (edge.target !== vId || !byId.has(edge.source)) continue
      if (!reachesSink.has(edge.source)) {
        reachesSink.add(edge.source)
        rqueue.push(edge.source)
      }
    }
  }

  // An edge is 'ok' (green) when its target can still reach a sink; otherwise it
  // feeds a dead end (red). Green nodes are the endpoints of ok edges; dead-end
  // targets join the blocked set so a misconfigured fan-out target shows red.
  const edgeHops: Record<string, number> = {}
  const edgeStatus: Record<string, 'ok' | 'blocked'> = {}
  const greenNodes = new Set<string>()
  const deadEnds = new Set<string>()
  for (const t of traversed) {
    if (!(t.id in edgeHops)) edgeHops[t.id] = fdist.get(t.u) ?? 0
    if (reachesSink.has(t.v)) {
      edgeStatus[t.id] = 'ok'
      greenNodes.add(t.u)
      greenNodes.add(t.v)
    } else {
      if (!(t.id in edgeStatus)) edgeStatus[t.id] = 'blocked'
      deadEnds.add(t.v)
    }
  }

  const pathNodeIds = [...greenNodes]
  const pathEdgeIds = Object.keys(edgeStatus).filter((id) => edgeStatus[id] === 'ok')

  // Red nodes: per-flow dead ends (incl. ingress blocks) + fan-out targets that
  // cannot reach a sink. A node that IS on a green path always wins (never red).
  const blockedNodeIds = [
    ...new Set([
      ...flows.map((f) => f.blockedNodeId).filter((id): id is string => id !== null),
      ...deadEnds,
    ]),
  ].filter((id) => !greenNodes.has(id))

  // Arrival pulse timing for the green nodes (hop distance from the entry).
  const arrivals: Record<string, number> = {}
  for (const id of greenNodes) {
    arrivals[id] = (fdist.get(id) ?? 0) * HOP_SECONDS
  }

  // Load-balancer fan-out: for each reachable, non-ingress-blocked balancer,
  // slot ALL of its outgoing traffic edges so the renderer can animate a
  // round-robin distribution across every registered target.
  const fanout: Record<string, { index: number; total: number }> = {}
  for (const node of nodes) {
    if (!BALANCERS.has(node.data.type)) continue
    if (!fdist.has(node.id) || ingressBlock(node)) continue
    const outs = trafficEdges.filter((e) => e.source === node.id && byId.has(e.target))
    if (outs.length < 2) continue // a single target is not a visible fan-out
    outs.forEach((e, index) => {
      fanout[e.id] = { index, total: outs.length }
    })
  }

  // Replication flow: once request traffic lands on a primary RDS, data streams
  // to each of its read replicas (rds → rds edges, filtered out of trafficEdges
  // as they carry no request traffic). Give each replica an arrival one hop after
  // its primary, but only when the primary is actually reached.
  const replicaArrivals: Record<string, number> = {}
  for (const e of edges) {
    const src = byId.get(e.source)
    const dst = byId.get(e.target)
    if (src?.data.type !== 'rds' || dst?.data.type !== 'rds') continue
    const primaryArrival = arrivals[e.source]
    if (primaryArrival === undefined) continue
    const t = primaryArrival + HOP_SECONDS
    const prev = replicaArrivals[e.target]
    if (prev === undefined || prev > t) replicaArrivals[e.target] = t
  }

  const okCount = flows.filter((f) => f.ok).length
  const ok = okCount === flows.length
  const message = ok
    ? flows.length === 1
      ? '요청이 정상적으로 목적지까지 도달했습니다! 🎉'
      : `모든 요청(${flows.length}개 경로)이 목적지에 도달했습니다! 🎉`
    : `${flows.length}개 경로 중 ${flows.length - okCount}개가 차단되었습니다.`

  return {
    ok,
    flows,
    message,
    pathNodeIds,
    pathEdgeIds,
    blockedNodeIds,
    edgeHops,
    arrivals,
    fanout,
    edgeStatus,
    replicaArrivals,
    deadNodeIds,
    failoverNodeIds,
    promotedNodeIds,
  }
}
