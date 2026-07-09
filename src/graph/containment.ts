import type { XYPosition } from '@xyflow/react'
import { canContain, isContainer } from '@/graph/rules'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Containment geometry helpers (ADR 0038 / 0040). Kept pure and store-free so
 * both the store (`attachToParent`, load normalization) and tests can reuse
 * them. The `ResourceNodeType` import is type-only, so there is no runtime
 * dependency cycle with the store.
 */

/**
 * Absolute canvas position of a node, folding in every ancestor's offset (React
 * Flow stores child positions relative to their parent).
 */
export function absolutePosition(
  byId: Map<string, ResourceNodeType>,
  id: string,
): XYPosition {
  let cur = byId.get(id)
  let x = 0
  let y = 0
  while (cur) {
    x += cur.position.x
    y += cur.position.y
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return { x, y }
}

/**
 * Stable topological order where every node follows its parent — React Flow
 * requires a parent to appear before its children in the `nodes` array, so
 * reparenting/normalization has to re-sort. Preserves the incoming order
 * otherwise.
 */
export function orderByParent(nodes: ResourceNodeType[]): ResourceNodeType[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const emitted = new Set<string>()
  const result: ResourceNodeType[] = []
  const emit = (n: ResourceNodeType) => {
    if (emitted.has(n.id)) return
    const parent = n.parentId ? byId.get(n.parentId) : undefined
    if (parent) emit(parent)
    emitted.add(n.id)
    result.push(n)
  }
  for (const n of nodes) emit(n)
  return result
}

/** True if `candidateId` sits somewhere in `rootId`'s subtree (a descendant). */
function isDescendant(
  byId: Map<string, ResourceNodeType>,
  rootId: string,
  candidateId: string,
): boolean {
  let cur = byId.get(candidateId)
  while (cur?.parentId) {
    if (cur.parentId === rootId) return true
    cur = byId.get(cur.parentId)
  }
  return false
}

/**
 * Auto-normalize containment (ADR 0040). A node that is spatially inside a
 * container it is allowed to nest under, but carries no `parentId`, is adopted
 * by the innermost such container — its position is converted to the parent's
 * frame and `extent: 'parent'` is set. Nodes that already have a parent are
 * left untouched ("없는 것만 채움"), so intentional nesting survives.
 *
 * Runs at load boundaries (shared URL, gallery slot, localStorage rehydrate)
 * where a design may carry a node visually inside a box without the logical
 * parent link — the state that made IGW/NAT look "detached" from their VPC.
 *
 * Containment is tested against the node's own origin point folded to absolute
 * coords; containers are matched by their absolute bounding box (needs an
 * explicit `style` size, which VPC/Subnet always have). Returns the same array
 * reference when nothing changes.
 */
export function normalizeContainment(nodes: ResourceNodeType[]): ResourceNodeType[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const abs = new Map(nodes.map((n) => [n.id, absolutePosition(byId, n.id)]))

  const containers = nodes
    .filter((n) => isContainer(n.data.type))
    .map((n) => {
      const a = abs.get(n.id)!
      const w = Number(n.style?.width ?? 0)
      const h = Number(n.style?.height ?? 0)
      return { id: n.id, type: n.data.type, x: a.x, y: a.y, w, h, area: w * h }
    })
    .filter((c) => c.w > 0 && c.h > 0)

  let changed = false
  const next = nodes.map((n) => {
    if (n.parentId) return n
    const p = abs.get(n.id)!
    const inner = containers
      .filter(
        (c) =>
          c.id !== n.id &&
          canContain(c.type, n.data.type) &&
          !isDescendant(byId, n.id, c.id) &&
          p.x >= c.x &&
          p.x <= c.x + c.w &&
          p.y >= c.y &&
          p.y <= c.y + c.h,
      )
      .sort((a, b) => a.area - b.area)[0]
    if (!inner) return n
    const parentAbs = abs.get(inner.id)!
    changed = true
    return {
      ...n,
      parentId: inner.id,
      extent: 'parent' as const,
      position: { x: p.x - parentAbs.x, y: p.y - parentAbs.y },
    }
  })

  return changed ? orderByParent(next) : nodes
}
