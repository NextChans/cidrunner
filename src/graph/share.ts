import type { Edge } from '@xyflow/react'
import { resources, type ResourceType } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Design sharing (ADR 0020): a design serializes to versioned JSON, carried
 * either as a downloaded `.json` file or base64url-packed in the URL fragment
 * (`#g=…`). The fragment never reaches the server, so sharing stays fully
 * static. Decoding REBUILDS nodes/edges from a whitelist of fields — foreign
 * JSON can't inject arbitrary props into the store.
 */

export interface DesignSnapshot {
  v: 1
  nodes: ResourceNodeType[]
  edges: Edge[]
}

export function toSnapshot(nodes: ResourceNodeType[], edges: Edge[]): DesignSnapshot {
  return { v: 1, nodes, edges }
}

/** UTF-8 safe base64url encode. */
function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(packed: string): string | null {
  try {
    const b64 = packed.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Builds a shareable URL for the current page carrying the design. */
export function encodeShareUrl(nodes: ResourceNodeType[], edges: Edge[]): string {
  const packed = b64urlEncode(JSON.stringify(toSnapshot(nodes, edges)))
  return `${location.origin}${location.pathname}#g=${packed}`
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Validates and rebuilds a snapshot from untrusted JSON. Returns null when the
 * shape is unusable; unknown fields are dropped.
 */
export function sanitizeSnapshot(raw: unknown): { nodes: ResourceNodeType[]; edges: Edge[] } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const snap = raw as Record<string, unknown>
  if (!Array.isArray(snap.nodes) || !Array.isArray(snap.edges)) return null

  const nodes: ResourceNodeType[] = []
  const ids = new Set<string>()
  for (const item of snap.nodes) {
    const n = item as Record<string, unknown>
    const data = (n.data ?? {}) as Record<string, unknown>
    const type = data.type as ResourceType
    const pos = (n.position ?? {}) as Record<string, unknown>
    if (typeof n.id !== 'string' || !(type in resources)) return null
    if (!isNum(pos.x) || !isNum(pos.y)) return null
    if (ids.has(n.id)) return null
    ids.add(n.id)

    const node: ResourceNodeType = {
      id: n.id,
      type: 'resource',
      position: { x: pos.x, y: pos.y },
      data: {
        type,
        label: typeof data.label === 'string' ? data.label : resources[type].label,
        config:
          typeof data.config === 'object' && data.config !== null
            ? { ...(data.config as Record<string, unknown>) }
            : { ...resources[type].defaults },
      },
    }
    if (typeof n.parentId === 'string') {
      node.parentId = n.parentId
      node.extent = 'parent'
    }
    const style = (n.style ?? {}) as Record<string, unknown>
    if (isNum(style.width) && isNum(style.height)) {
      node.style = { width: style.width, height: style.height }
    }
    nodes.push(node)
  }
  // Parents must exist.
  for (const n of nodes) {
    if (n.parentId && !ids.has(n.parentId)) return null
  }

  const edges: Edge[] = []
  for (const item of snap.edges) {
    const e = item as Record<string, unknown>
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      return null
    }
    if (!ids.has(e.source) || !ids.has(e.target)) return null
    edges.push({ id: e.id, source: e.source, target: e.target, type: 'traffic' })
  }

  return { nodes, edges }
}

/** Parses a design out of `location.hash` (`#g=…`), if present and valid. */
export function designFromHash(hash: string): { nodes: ResourceNodeType[]; edges: Edge[] } | null {
  const match = hash.match(/^#g=(.+)$/)
  if (!match) return null
  const json = b64urlDecode(match[1])
  if (!json) return null
  try {
    return sanitizeSnapshot(JSON.parse(json))
  } catch {
    return null
  }
}
