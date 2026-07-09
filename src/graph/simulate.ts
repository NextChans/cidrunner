import type { Edge } from '@xyflow/react'
import { getResource } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { ResourceType } from '@/resources'

/**
 * Traffic simulation (Phase 3, extended to multi-flow — ADR 0018). Pressing
 * Start traces a request from EVERY entry point (each ALB, each Lambda with no
 * inbound traffic) along the traffic edges to a data sink (RDS or S3). Edges
 * whose source is a Security Group are *attachments*, not traffic, and are
 * ignored here (ADR 0017).
 */

/** Seconds per hop — drives particle stagger and arrival pulses. */
export const HOP_SECONDS = 0.45

/** One traced request, from one entry. */
export interface SimFlow {
  entryId: string
  ok: boolean
  /** Node ids on the traced path, in visit order. */
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
  'alb',
  'lambda',
  'ecs',
  'eks',
  // A Kinesis stream that nothing feeds is the head of a data pipeline
  // (ingestion → Lambda consumer → sink) — ADR 0035.
  'kinesis',
])

function blockedMessage(type: ResourceType): string {
  switch (type) {
    case 'route53':
      return 'Route 53 레코드가 가리킬 대상(CloudFront/ALB)이 없습니다.'
    case 'cloudfront':
      return 'CloudFront에 오리진(ALB/S3)이 연결되어 있지 않습니다.'
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

/** Traces one request greedily from `entry` along traffic edges. */
function traceFlow(
  entry: ResourceNodeType,
  byId: Map<string, ResourceNodeType>,
  trafficEdges: Edge[],
): SimFlow {
  const pathNodeIds: string[] = []
  const pathEdgeIds: string[] = []
  const visited = new Set<string>()

  let current: ResourceNodeType | undefined = entry
  while (current) {
    pathNodeIds.push(current.id)
    visited.add(current.id)

    if (SINKS.has(current.data.type)) {
      return {
        entryId: entry.id,
        ok: true,
        pathNodeIds,
        pathEdgeIds,
        blockedNodeId: null,
        label: pathNodeIds.map((id) => byId.get(id)?.data.label ?? id).join(' → '),
        message: '도달',
      }
    }

    let chosen: { edge: Edge; node: ResourceNodeType } | undefined
    for (const edge of trafficEdges) {
      if (edge.source !== current.id) continue
      const node = byId.get(edge.target)
      if (node && !visited.has(node.id)) {
        chosen = { edge, node }
        break
      }
    }

    if (!chosen) {
      return {
        entryId: entry.id,
        ok: false,
        pathNodeIds,
        pathEdgeIds,
        blockedNodeId: current.id,
        label: pathNodeIds.map((id) => byId.get(id)?.data.label ?? id).join(' → '),
        message: blockedMessage(current.data.type),
      }
    }

    pathEdgeIds.push(chosen.edge.id)
    current = chosen.node
  }

  // Unreachable, but keeps the types honest.
  return {
    entryId: entry.id,
    ok: false,
    pathNodeIds,
    pathEdgeIds,
    blockedNodeId: entry.id,
    label: entry.data.label,
    message: '경로를 완성할 수 없습니다.',
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
      message: '트래픽 진입점이 없습니다. Route 53 / CloudFront / ALB / Lambda를 추가하세요.',
      pathNodeIds: [],
      pathEdgeIds: [],
      blockedNodeIds: [],
      edgeHops: {},
      arrivals: {},
    }
  }

  const flows = entries.map((entry) => traceFlow(entry, byId, trafficEdges))

  const pathNodeIds = [...new Set(flows.flatMap((f) => f.pathNodeIds))]
  const pathEdgeIds = [...new Set(flows.flatMap((f) => f.pathEdgeIds))]
  const blockedNodeIds = flows
    .map((f) => f.blockedNodeId)
    .filter((id): id is string => id !== null)

  const edgeHops: Record<string, number> = {}
  const arrivals: Record<string, number> = {}
  for (const flow of flows) {
    flow.pathEdgeIds.forEach((edgeId, i) => {
      if (!(edgeId in edgeHops)) edgeHops[edgeId] = i
    })
    flow.pathNodeIds.forEach((nodeId, i) => {
      const t = i * HOP_SECONDS
      const prev = arrivals[nodeId]
      if (prev === undefined || prev > t) arrivals[nodeId] = t
    })
  }

  const okCount = flows.filter((f) => f.ok).length
  const ok = okCount === flows.length
  const message = ok
    ? flows.length === 1
      ? '요청이 정상적으로 목적지까지 도달했습니다! 🎉'
      : `모든 요청(${flows.length}개 경로)이 목적지에 도달했습니다! 🎉`
    : `${flows.length}개 경로 중 ${flows.length - okCount}개가 차단되었습니다.`

  return { ok, flows, message, pathNodeIds, pathEdgeIds, blockedNodeIds, edgeHops, arrivals }
}
