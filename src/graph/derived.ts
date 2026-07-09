import type { Edge } from '@xyflow/react'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Engine-owned *derived* edges (ADR 0043). Unlike the traffic/attachment edges
 * the player draws, these are computed from the graph's plumbing and are never
 * editable, selectable, deletable, or persisted — they exist purely to make an
 * implicit relationship visible on the canvas.
 *
 * Today this renders the Internet Gateway's routing: an IGW nested in a VPC
 * gives every *public* subnet in that VPC its `0.0.0.0/0 → IGW` default route,
 * so we draw a subtle dashed arrow IGW → each public subnet. The framework is
 * generic, so future plumbing (e.g. RDS → its subnet group) can reuse it.
 */
export const DERIVED_EDGE_PREFIX = 'derived-'

/**
 * Handle ids for derived edges. Derived edges connect nodes that own no
 * interactive connection handle (an IGW is not an edge source; a subnet is a
 * container with none at all), so every node renders a dedicated pair of hidden,
 * non-connectable handles just for these engine-owned edges to anchor to.
 */
export const DERIVED_SOURCE_HANDLE = 'derived-src'
export const DERIVED_TARGET_HANDLE = 'derived-tgt'

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

/** Builds the derived (engine-owned) edges for the current graph. */
export function derivedEdges(nodes: ResourceNodeType[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: Edge[] = []

  for (const igw of nodes) {
    if (igw.data.type !== 'igw') continue
    const vpc = vpcOf(igw, byId)
    if (!vpc) continue
    for (const subnet of nodes) {
      if (
        subnet.data.type !== 'subnet' ||
        subnet.data.config.public !== true ||
        vpcOf(subnet, byId)?.id !== vpc.id
      ) {
        continue
      }
      out.push({
        id: `${DERIVED_EDGE_PREFIX}igw-${igw.id}-${subnet.id}`,
        source: igw.id,
        target: subnet.id,
        sourceHandle: DERIVED_SOURCE_HANDLE,
        targetHandle: DERIVED_TARGET_HANDLE,
        type: 'derived',
        selectable: false,
        deletable: false,
        focusable: false,
        reconnectable: false,
      })
    }
  }

  return out
}
