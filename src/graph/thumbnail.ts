import { getResource } from '@/resources'
import type { ResourceCategory } from '@/resources/types'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Gallery thumbnails (ADR 0033) are rendered as pure SVG straight from a saved
 * snapshot's node positions — no canvas capture, no image storage. This module
 * turns the (parent-relative) node tree into a flat list of viewBox-space boxes
 * so the Gallery can draw a faithful mini-map of the design.
 */

/** A resolved, normalized box in the thumbnail's viewBox coordinate space. */
export interface ThumbBox {
  x: number
  y: number
  w: number
  h: number
  /** Fill/stroke colour (hex), derived from the resource category. */
  color: string
  /** Containers (VPC/Subnet) draw as outlined frames, leaves as filled chips. */
  container: boolean
}

/** Category → hex, mirroring the accent palette without importing Tailwind. */
const CATEGORY_HEX: Record<ResourceCategory, string> = {
  network: '#38bdf8',
  compute: '#34d399',
  database: '#a78bfa',
  storage: '#fbbf24',
  integration: '#f472b6',
  management: '#94a3b8',
  security: '#fb7185',
}

/** Fallback footprint for a leaf node (no explicit container size). */
const LEAF_W = 46
const LEAF_H = 32

interface RawBox {
  x: number
  y: number
  w: number
  h: number
  color: string
  container: boolean
}

/** Folds a node's parent chain into an absolute canvas position. */
function absolutePosition(
  node: ResourceNodeType,
  byId: Map<string, ResourceNodeType>,
): { x: number; y: number } {
  let { x, y } = node.position
  let pid = node.parentId
  const seen = new Set<string>([node.id])
  while (pid && !seen.has(pid)) {
    seen.add(pid)
    const parent = byId.get(pid)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    pid = parent.parentId
  }
  return { x, y }
}

/**
 * Projects `nodes` into up to `width`×`height` viewBox space, preserving aspect
 * ratio and centring. Returns an empty array for an empty design (the caller
 * shows a placeholder). Boxes are sorted largest-first so containers render
 * beneath the chips they hold.
 */
export function thumbnailBoxes(
  nodes: ResourceNodeType[],
  width = 300,
  height = 200,
  pad = 12,
): ThumbBox[] {
  if (nodes.length === 0) return []
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const raw: RawBox[] = nodes.map((n) => {
    const { x, y } = absolutePosition(n, byId)
    const meta = getResource(n.data.type)
    const style = n.style as { width?: number; height?: number } | undefined
    const w = typeof style?.width === 'number' ? style.width : LEAF_W
    const h = typeof style?.height === 'number' ? style.height : LEAF_H
    return { x, y, w, h, color: CATEGORY_HEX[meta.category], container: !!meta.container }
  })

  const minX = Math.min(...raw.map((b) => b.x))
  const minY = Math.min(...raw.map((b) => b.y))
  const maxX = Math.max(...raw.map((b) => b.x + b.w))
  const maxY = Math.max(...raw.map((b) => b.y + b.h))
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1

  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)
  // Centre the scaled content within the viewBox.
  const offX = pad + ((width - pad * 2) - spanX * scale) / 2
  const offY = pad + ((height - pad * 2) - spanY * scale) / 2

  const boxes: ThumbBox[] = raw.map((b) => ({
    x: offX + (b.x - minX) * scale,
    y: offY + (b.y - minY) * scale,
    w: Math.max(2, b.w * scale),
    h: Math.max(2, b.h * scale),
    color: b.color,
    container: b.container,
  }))

  // Largest area first → containers sit behind their children.
  boxes.sort((a, b) => b.w * b.h - a.w * a.h)
  return boxes
}
