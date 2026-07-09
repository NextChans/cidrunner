import type { ResourceType } from '@/resources/types'
import type { MissionCheckContext } from './types'

/** One step of a {@link liveChain} pattern: a resource type, or any-of a set. */
export type ChainStep = ResourceType | readonly ResourceType[]

/**
 * Finds a live directed chain of resource *types* over the simulation's `ok`
 * edges — the edges that lie on some reachable entry→sink path (ADR 0047/0049).
 *
 * Grading the required topology structurally (rather than inspecting the single
 * flow the DFS happened to trace) makes missions robust to two things the
 * single-path model got wrong on real builds:
 *  - **forks** — an ALB that fans out to EC2 *and* a container: the traced path
 *    may take the EC2 branch, hiding the container branch the mission needs.
 *  - **optional fronts** — an API Gateway ahead of a producer Lambda, or a
 *    CloudFront ahead of an ALB: the chain is graded wherever it lives, not only
 *    when its head is the traffic entry.
 *
 * `pattern` is the type sequence to walk (each step may list alternatives, e.g.
 * `['alb', ['ecs', 'eks'], 'rds']`). Returns the matched node ids in order, or
 * `null`. The match is a simple path (no node reused), so a producer/consumer
 * pair is never satisfied by one node looping on itself.
 */
export function liveChain(
  ctx: Pick<MissionCheckContext, 'nodes' | 'edges' | 'sim'>,
  pattern: readonly ChainStep[],
): string[] | null {
  if (pattern.length === 0) return null
  const typeOf = (id: string) => ctx.nodes.find((n) => n.id === id)?.data.type
  const ok = new Set(ctx.sim.pathEdgeIds)
  const matches = (t: ResourceType | undefined, spec: ChainStep) =>
    t !== undefined && (Array.isArray(spec) ? spec.includes(t) : t === spec)
  const step = (from: string, spec: ChainStep) =>
    ctx.edges.filter((e) => ok.has(e.id) && e.source === from && matches(typeOf(e.target), spec))

  const walk = (nodeId: string, i: number, acc: string[]): string[] | null => {
    if (i === pattern.length) return acc
    for (const e of step(nodeId, pattern[i]!)) {
      if (acc.includes(e.target)) continue // simple path — never reuse a node
      const found = walk(e.target, i + 1, [...acc, e.target])
      if (found) return found
    }
    return null
  }

  for (const n of ctx.nodes) {
    if (!matches(n.data.type, pattern[0]!)) continue
    const found = walk(n.id, 1, [n.id])
    if (found) return found
  }
  return null
}

/**
 * The node ids that make up a mission's *connected build* (ADR 0041): the
 * closure of `anchors` over edges (in either direction — traffic edges AND
 * Security-Group attachment edges, whose source is the SG) and the containment
 * parent chain.
 *
 * This deliberately EXCLUDES unrelated leftover nodes elsewhere on the canvas —
 * most notably the starter VPC▸Subnet▸EC2 seed a non-VPC mission (static CDN,
 * async pipeline, …) never touches. Before this, that seed's SG-less EC2 raised
 * a security warning that pinned `securityOk` to false, capping every such
 * mission at ★2 while its (irrelevant) hint kept nagging about the mission's own
 * resources — the bug reported for the "글로벌 정적 웹" and "비동기 파이프라인"
 * missions.
 */
export function missionBuildIds(
  ctx: Pick<MissionCheckContext, 'nodes' | 'edges'>,
  anchors: Iterable<string>,
): Set<string> {
  const byId = new Map(ctx.nodes.map((n) => [n.id, n]))
  const ids = new Set<string>(anchors)
  let grew = true
  while (grew) {
    grew = false
    // Edge neighbours in both directions: an SG attaches by drawing SG → node,
    // so the SG is the edge *source*; walking targets→sources pulls it in.
    for (const e of ctx.edges) {
      if (ids.has(e.source) && !ids.has(e.target)) {
        ids.add(e.target)
        grew = true
      }
      if (ids.has(e.target) && !ids.has(e.source)) {
        ids.add(e.source)
        grew = true
      }
    }
    // Containment: a node's warnings/errors belong to the design it sits in, so
    // pull in each included node's parent chain (subnet → VPC). Snapshot first —
    // we mutate `ids` inside the loop.
    for (const id of Array.from(ids)) {
      const parent = byId.get(id)?.parentId
      if (parent && !ids.has(parent)) {
        ids.add(parent)
        grew = true
      }
    }
  }
  return ids
}

/**
 * True when no node in the mission's connected build (see {@link missionBuildIds})
 * carries a security/best-practice warning. This is the scoped replacement for
 * the whole-graph `ctx.securityOk` used by the ★3 "보안 경고 0" tier.
 */
export function scopedSecurityOk(ctx: MissionCheckContext, anchors: Iterable<string>): boolean {
  const ids = missionBuildIds(ctx, anchors)
  for (const id of ids) {
    if ((ctx.issues.warnings.get(id)?.length ?? 0) > 0) return false
  }
  return true
}
