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
  /** Union of all flows' path nodes (highlighting). */
  pathNodeIds: string[]
  /** Union of all flows' path edges. */
  pathEdgeIds: string[]
  /** All blocking nodes across flows. */
  blockedNodeIds: string[]
  /** edge id → hop index within its flow (particle stagger). */
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

/** Runs the simulation over the whole graph: one flow per entry point. */
export function simulate(nodes: ResourceNodeType[], edges: Edge[]): SimResult {
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
    }
  }

  const ingressBlock = (node: ResourceNodeType) =>
    internetIngressBlock(node, byId, nodes)
  const flows = entries.map((entry) => traceFlow(entry, byId, trafficEdges, ingressBlock))

  const pathNodeIds = [...new Set(flows.flatMap((f) => f.pathNodeIds))]
  const pathEdgeIds = [...new Set(flows.flatMap((f) => f.pathEdgeIds))]
  const blockedNodeIds = flows
    .map((f) => f.blockedNodeId)
    .filter((id): id is string => id !== null)

  const edgeHops: Record<string, number> = {}
  const arrivals: Record<string, number> = {}
  const edgeStatus: Record<string, 'ok' | 'blocked'> = {}
  for (const flow of flows) {
    flow.pathEdgeIds.forEach((edgeId, i) => {
      if (!(edgeId in edgeHops)) edgeHops[edgeId] = i
      // 'ok' always wins over 'blocked' for an edge shared across flows.
      if (flow.ok) edgeStatus[edgeId] = 'ok'
      else if (!(edgeId in edgeStatus)) edgeStatus[edgeId] = 'blocked'
    })
    flow.pathNodeIds.forEach((nodeId, i) => {
      const t = i * HOP_SECONDS
      const prev = arrivals[nodeId]
      if (prev === undefined || prev > t) arrivals[nodeId] = t
    })
  }

  // Load-balancer fan-out: for each reachable, unblocked balancer, slot ALL of
  // its outgoing traffic edges (even ones off the traced success path) so the
  // renderer can animate a round-robin distribution across every target.
  const reached = new Set(pathNodeIds)
  const blocked = new Set(blockedNodeIds)
  const fanout: Record<string, { index: number; total: number }> = {}
  for (const node of nodes) {
    if (!BALANCERS.has(node.data.type)) continue
    if (!reached.has(node.id) || blocked.has(node.id)) continue
    const outs = trafficEdges.filter((e) => e.source === node.id && byId.has(e.target))
    if (outs.length < 2) continue // a single target is not a visible fan-out
    outs.forEach((e, index) => {
      fanout[e.id] = { index, total: outs.length }
    })
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
  }
}
