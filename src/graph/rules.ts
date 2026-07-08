import { getResource, resourceList, type ResourceType } from '@/resources'

/**
 * Graph rule model (Phase 1). All nesting and edge constraints are derived from
 * the data-driven `ResourceMeta` fields (`allowedParents`, `container`,
 * `connectsTo`) so the canvas stays free of per-resource branching.
 */

/** True if `type` is a container that can visually hold child nodes. */
export function isContainer(type: ResourceType): boolean {
  return getResource(type).container === true
}

/** True if a node of type `child` may be nested inside a node of type `parent`. */
export function canContain(parent: ResourceType, child: ResourceType): boolean {
  return getResource(child).allowedParents.includes(parent)
}

/** True if `type` may sit unparented at the top level of the canvas. */
export function canBeTopLevel(type: ResourceType): boolean {
  return getResource(type).allowedParents.includes('canvas')
}

/**
 * True if a directional edge `source → target` is allowed. Same-type edges are
 * legal when declared (e.g. RDS → RDS is a replication link — ADR 0019);
 * connecting a node to itself is blocked at the canvas level by node id.
 */
export function canConnect(source: ResourceType, target: ResourceType): boolean {
  return getResource(source).connectsTo?.includes(target) ?? false
}

/** Types that at least one resource may connect an edge to (valid targets). */
const connectTargets: ReadonlySet<ResourceType> = new Set(
  resourceList.flatMap((m) => m.connectsTo ?? []),
)

/** True if `type` may originate an edge. */
export function canBeSource(type: ResourceType): boolean {
  return (getResource(type).connectsTo?.length ?? 0) > 0
}

/** True if `type` may be the target of an edge. */
export function canBeTarget(type: ResourceType): boolean {
  return connectTargets.has(type)
}

/**
 * Korean label listing the containers a resource must live in, for use in
 * rejection messages (e.g. "Subnet" or "VPC 또는 Subnet").
 */
export function requiredParentLabel(type: ResourceType): string {
  return getResource(type)
    .allowedParents.filter((p): p is ResourceType => p !== 'canvas')
    .map((p) => getResource(p).label)
    .join(' 또는 ')
}
