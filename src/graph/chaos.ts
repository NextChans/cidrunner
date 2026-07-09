import type { Edge } from '@xyflow/react'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Chaos mode (ADR 0052) — fault injection. "Kill AZ X" knocks out every resource
 * pinned to that Availability Zone, then the simulation re-runs on the survivors
 * so the player can *see* whether the design survives a zone failure. This is
 * what makes multi-AZ, RDS Multi-AZ failover, and ALB fan-out worth paying for —
 * and the counterweight to the Budget mode (ADR 0051): a single-AZ RDS is cheaper
 * but dies here; a Multi-AZ one costs 2× but survives.
 */

/** The AZ a node lives in: its enclosing Subnet's `az`, or the node's own `az`
 * for a Subnet / AZ box. Returns null for AZ-independent resources (an ALB that
 * spans AZs, or a global service like S3/CloudFront). */
export function nodeAz(
  node: ResourceNodeType,
  byId: Map<string, ResourceNodeType>,
): string | null {
  if (node.data.type === 'subnet' || node.data.type === 'az') {
    return typeof node.data.config.az === 'string' ? node.data.config.az : 'a'
  }
  let cur: ResourceNodeType | undefined = node.parentId ? byId.get(node.parentId) : undefined
  while (cur) {
    if (cur.data.type === 'subnet') {
      return typeof cur.data.config.az === 'string' ? cur.data.config.az : 'a'
    }
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return null
}

/** Distinct AZs present in the graph (from subnets + AZ boxes), sorted. */
export function graphAzs(nodes: ResourceNodeType[]): string[] {
  const set = new Set<string>()
  for (const n of nodes) {
    if (n.data.type === 'subnet' || n.data.type === 'az') {
      set.add(typeof n.data.config.az === 'string' ? n.data.config.az : 'a')
    }
  }
  return [...set].sort()
}

/**
 * Node ids knocked out when availability zone `az` fails. A resource dies if it
 * is pinned to `az` — EXCEPT a Multi-AZ RDS, which fails over to its standby in
 * another zone and survives (the reward for paying 2×).
 */
export function deadNodesForAz(nodes: ResourceNodeType[], az: string): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const dead = new Set<string>()
  for (const n of nodes) {
    if (nodeAz(n, byId) !== az) continue
    if (n.data.type === 'rds' && n.data.config.multi_az === true) continue // failover survives
    dead.add(n.id)
  }
  return dead
}

/** The full effect of an AZ failure on the graph (ADR 0053). */
export interface AzFault {
  /** Nodes removed by the fault (dead master included; a promoted replica is NOT). */
  deadNodeIds: Set<string>
  /** Edges with dead-master targets redirected to their promoted replica. */
  edges: Edge[]
  /** Multi-AZ RDS that survived via automatic failover (same endpoint). */
  failoverIds: string[]
  /** Read replicas promoted to primary because their master died. */
  promotedIds: string[]
}

/**
 * Applies an AZ failure (ADR 0053), modeling the two RDS resilience patterns:
 *
 * - **Multi-AZ** — an RDS with `multi_az` rides out the failure via automatic
 *   failover to its standby, keeping the SAME endpoint (no promotion). It stays
 *   alive; its id lands in `failoverIds` for a ⚡ badge.
 * - **Read replica** — a single-AZ master that dies with the AZ is replaced by
 *   promoting a read replica in a surviving AZ (rds → rds edge). Request traffic
 *   that pointed at the dead master is rerouted to the promoted replica.
 */
export function applyAzFault(
  nodes: ResourceNodeType[],
  edges: Edge[],
  az: string,
): AzFault {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const deadNodeIds = deadNodesForAz(nodes, az)
  const failoverIds = nodes
    .filter(
      (n) => nodeAz(n, byId) === az && n.data.type === 'rds' && n.data.config.multi_az === true,
    )
    .map((n) => n.id)

  // Promote a live read replica for each dead single-AZ master (master → replica
  // replication edge, replica in a surviving AZ). Reroute traffic to the replica.
  const promote = new Map<string, string>() // dead master id → replica id
  for (const e of edges) {
    if (byId.get(e.source)?.data.type !== 'rds' || byId.get(e.target)?.data.type !== 'rds') continue
    if (deadNodeIds.has(e.source) && !deadNodeIds.has(e.target) && !promote.has(e.source)) {
      promote.set(e.source, e.target)
    }
  }
  const rewired = edges.map((e) => {
    const replica = promote.get(e.target)
    return replica && !deadNodeIds.has(e.source) ? { ...e, target: replica } : e
  })

  return { deadNodeIds, edges: rewired, failoverIds, promotedIds: [...promote.values()] }
}
