import type { Edge } from '@xyflow/react'
import { getResource } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { ResourceType } from '@/resources'

/**
 * Result of tracing one request through the topology (Phase 3). The request
 * starts at a virtual client, enters through a front-door node (ALB or Lambda),
 * and should reach a data sink (RDS or S3): client → LB → app → DB.
 */
export interface SimResult {
  ok: boolean
  /** Node ids on the traced path, in visit order (for highlighting). */
  pathNodeIds: string[]
  /** Edge ids on the traced path, in visit order (for particle animation). */
  pathEdgeIds: string[]
  /** The node where the path broke, if it failed. */
  blockedNodeId: string | null
  /** Player-facing Korean summary of the run. */
  message: string
}

/** Types that terminate a successful request (the "DB / storage" tier). */
const SINKS: ReadonlySet<ResourceType> = new Set<ResourceType>(['rds', 's3'])

/** Front-door types where client traffic can enter. */
const ENTRIES: ReadonlySet<ResourceType> = new Set<ResourceType>(['alb', 'lambda'])

function blockedMessage(type: ResourceType): string {
  switch (type) {
    case 'alb':
      return '로드 밸런서에서 대상(EC2/Lambda)으로 가는 연결이 없습니다.'
    case 'ec2':
      return 'EC2에서 데이터베이스나 스토리지로 가는 경로가 없습니다.'
    case 'lambda':
      return 'Lambda에서 데이터베이스나 스토리지로 가는 경로가 없습니다.'
    default:
      return `${getResource(type).label}에서 경로가 끊겼습니다.`
  }
}

/**
 * Traces a single request greedily from the chosen entry along directed edges
 * until it reaches a sink (success) or runs out of forward edges (blocked).
 */
export function simulate(nodes: ResourceNodeType[], edges: Edge[]): SimResult {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = (id: string) => edges.filter((e) => e.source === id)

  // Pick an entry: prefer an ALB, else a Lambda that receives no traffic.
  const albs = nodes.filter((n) => n.data.type === 'alb')
  const lambdaEntries = nodes.filter(
    (n) => n.data.type === 'lambda' && !edges.some((e) => e.target === n.id),
  )
  const entry = albs[0] ?? lambdaEntries[0] ?? null

  if (!entry) {
    return {
      ok: false,
      pathNodeIds: [],
      pathEdgeIds: [],
      blockedNodeId: null,
      message: '트래픽 진입점이 없습니다. ALB 또는 Lambda를 추가하세요.',
    }
  }

  const pathNodeIds: string[] = []
  const pathEdgeIds: string[] = []
  const visited = new Set<string>()

  let current: ResourceNodeType | undefined = entry
  while (current) {
    pathNodeIds.push(current.id)
    visited.add(current.id)

    if (SINKS.has(current.data.type)) {
      return {
        ok: true,
        pathNodeIds,
        pathEdgeIds,
        blockedNodeId: null,
        message: '요청이 정상적으로 목적지까지 도달했습니다! 🎉',
      }
    }

    // Step to the first unvisited forward neighbour.
    let chosen: { edge: Edge; node: ResourceNodeType } | undefined
    for (const edge of outgoing(current.id)) {
      const node = byId.get(edge.target)
      if (node && !visited.has(node.id)) {
        chosen = { edge, node }
        break
      }
    }

    if (!chosen) {
      return {
        ok: false,
        pathNodeIds,
        pathEdgeIds,
        blockedNodeId: current.id,
        message: blockedMessage(current.data.type),
      }
    }

    pathEdgeIds.push(chosen.edge.id)
    current = chosen.node
  }

  return {
    ok: false,
    pathNodeIds,
    pathEdgeIds,
    blockedNodeId: entry.id,
    message: '경로를 완성할 수 없습니다.',
  }
}

/** Whether a resource type can act as a traffic entry (front door). */
export function isEntryType(type: ResourceType): boolean {
  return ENTRIES.has(type)
}
