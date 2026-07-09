import type { MissionCheckContext } from './types'

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
