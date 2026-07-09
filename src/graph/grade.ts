import type { Edge } from '@xyflow/react'
import type { ResourceNodeType } from '@/store/useGraphStore'
import { graphIssues } from './checks'
import { simulate } from './simulate'
import { graphAzs, applyAzFault } from './chaos'
import { nodeMonthlyCost } from './cost'

/**
 * Well-Architected grade (ADR 0054) — a lightweight, heuristic score across four
 * pillars, synthesized from signals the app already computes: the validation
 * sweep (security), the chaos AZ-failure test (reliability), the cost model
 * (cost), and resource composition (performance). It turns free mode into a
 * "raise your grade" sandbox and ties Budget (ADR 0051) + Chaos (ADR 0052/0053)
 * together. These are game-balance heuristics, not an AWS audit.
 */

export interface Grade {
  pillars: { security: number; reliability: number; cost: number; performance: number }
  /** 0–100 average of the four pillars. */
  overall: number
  letter: 'S' | 'A' | 'B' | 'C' | 'D'
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const has = (nodes: ResourceNodeType[], type: string) => nodes.some((n) => n.data.type === type)

/** Every node touched by at least one edge (traffic or SG attachment). */
function connected(id: string, edges: Edge[]): boolean {
  return edges.some((e) => e.source === id || e.target === id)
}

export function wellArchitectedGrade(nodes: ResourceNodeType[], edges: Edge[]): Grade {
  const empty: Grade = {
    pillars: { security: 0, reliability: 0, cost: 0, performance: 0 },
    overall: 0,
    letter: 'D',
  }
  if (nodes.length === 0) return empty

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const issues = graphIssues(nodes, edges)
  const healthy = simulate(nodes, edges).ok

  // 🔒 Security — start full, penalize each node carrying a warning.
  const warned = nodes.filter((n) => (issues.warnings.get(n.id)?.length ?? 0) > 0).length
  const security = clamp(100 - warned * 15)

  // 🛡 Reliability — does traffic work, and does it survive an AZ failure?
  const azs = graphAzs(nodes)
  const rdsList = nodes.filter((n) => n.data.type === 'rds')
  const replicaSources = new Set(
    edges
      .filter((e) => byId.get(e.source)?.data.type === 'rds' && byId.get(e.target)?.data.type === 'rds')
      .map((e) => e.source),
  )
  // `every` is true for an empty list — no DB means no DB-failure risk.
  const dbResilient = rdsList.every(
    (n) => n.data.config.multi_az === true || replicaSources.has(n.id),
  )
  let reliability: number
  if (!healthy) {
    reliability = 20
  } else if (azs.length === 0) {
    reliability = 85 // fully managed / serverless — inherently multi-AZ
  } else {
    let r = 40
    if (azs.length >= 2) r += 20
    if (dbResilient) r += 15
    // Survives a single-AZ failure only if EVERY zone can go down and traffic
    // still reaches a sink (needs ≥2 AZs to be meaningful).
    let survived = 0
    for (const az of azs) {
      const fault = applyAzFault(nodes, edges, az)
      if (simulate(nodes, fault.edges, { deadNodeIds: fault.deadNodeIds }).ok) survived += 1
    }
    if (azs.length >= 2 && survived === azs.length) r += 25
    reliability = clamp(r)
  }

  // 💰 Cost — efficiency, not magnitude: penalize expensive resources left
  // unwired (paying for nothing). NAT/IGW are placement-based, so excluded.
  const COSTLY_WIRED = new Set(['alb', 'rds', 'eks', 'ecs', 'elasticache'])
  const idle = nodes.filter(
    (n) => COSTLY_WIRED.has(n.data.type) && nodeMonthlyCost(n) >= 10 && !connected(n.id, edges),
  ).length
  const cost = clamp(100 - idle * 25)

  // ⚡ Performance — reward appropriate accelerators (heuristic).
  let perf = 55
  if (has(nodes, 'cloudfront')) perf += 15 // CDN / edge caching
  if (has(nodes, 'elasticache')) perf += 15 // in-memory cache
  if (replicaSources.size > 0) perf += 8 // read scaling via replica
  if (has(nodes, 'alb')) perf += 7 // load distribution
  const performance = clamp(perf)

  const overall = clamp((security + reliability + cost + performance) / 4)
  const letter: Grade['letter'] =
    overall >= 90 ? 'S' : overall >= 75 ? 'A' : overall >= 60 ? 'B' : overall >= 45 ? 'C' : 'D'

  return { pillars: { security, reliability, cost, performance }, overall, letter }
}
