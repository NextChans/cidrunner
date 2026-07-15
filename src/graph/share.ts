import type { Edge } from '@xyflow/react'
import { resources, type ResourceType } from '@/resources'
import { getMission } from '@/missions'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { SecurityGroupDef } from '@/graph/securityGroups'
import { b64urlEncode, b64urlDecode } from '@/graph/base64url'

/**
 * Design sharing (ADR 0020): a design serializes to versioned JSON, carried
 * either as a downloaded `.json` file or base64url-packed in the URL fragment
 * (`#g=…`). The fragment never reaches the server, so sharing stays fully
 * static. Decoding REBUILDS nodes/edges from a whitelist of fields — foreign
 * JSON can't inject arbitrary props into the store.
 */

export interface DesignSnapshot {
  /** v1 wired SGs as nodes+edges; v2 carries them as a collection (ADR 0059). */
  v: 1 | 2
  nodes: ResourceNodeType[]
  edges: Edge[]
  /** Active mission id, so a shared submission opens in grading context. */
  m?: string
  /** Security-group definitions (ADR 0059). Absent in v1 payloads. */
  sg?: SecurityGroupDef[]
}

export interface LoadedDesign {
  nodes: ResourceNodeType[]
  edges: Edge[]
  missionId?: string
  securityGroups: SecurityGroupDef[]
  /** Resource types skipped because cidrunner doesn't model them (for a notice). */
  unsupportedTypes: string[]
}

export function toSnapshot(
  nodes: ResourceNodeType[],
  edges: Edge[],
  missionId?: string | null,
  securityGroups: SecurityGroupDef[] = [],
): DesignSnapshot {
  const snap: DesignSnapshot = { v: 2, nodes, edges }
  if (missionId) snap.m = missionId
  if (securityGroups.length) snap.sg = securityGroups
  return snap
}

/** Builds a shareable URL for the current page carrying the design. */
export function encodeShareUrl(
  nodes: ResourceNodeType[],
  edges: Edge[],
  missionId?: string | null,
  securityGroups: SecurityGroupDef[] = [],
): string {
  const packed = b64urlEncode(
    JSON.stringify(toSnapshot(nodes, edges, missionId, securityGroups)),
  )
  return `${location.origin}${location.pathname}#g=${packed}`
}

/** Rebuilds a SecurityGroupDef from untrusted JSON, or null if unusable. */
function sanitizeSgDef(raw: unknown): SecurityGroupDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Record<string, unknown>
  if (typeof s.id !== 'string') return null
  return {
    id: s.id,
    name: typeof s.name === 'string' ? s.name : s.id,
    allowHttp: s.allowHttp !== false,
    allowHttps: s.allowHttps !== false,
    allowSsh: s.allowSsh === true,
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** First finite number among the candidates, or undefined. */
const firstNum = (...vals: unknown[]): number | undefined =>
  vals.find((v): v is number => typeof v === 'number' && Number.isFinite(v))

/**
 * Validates and rebuilds a snapshot from untrusted JSON. Returns null when the
 * shape is unusable; unknown fields are dropped.
 */
export function sanitizeSnapshot(raw: unknown): LoadedDesign | null {
  if (typeof raw !== 'object' || raw === null) return null
  const snap = raw as Record<string, unknown>
  if (!Array.isArray(snap.nodes) || !Array.isArray(snap.edges)) return null

  // Security groups (ADR 0059). A v1 payload wired SGs as `type:'sg'` nodes with
  // `sg → resource` attachment edges; v2 carries a `sg` collection + each
  // resource's `config.securityGroupIds`. We MUST keep translating v1 forever —
  // shared `#g=` URLs are immutable — so legacy sg nodes become defs here and
  // their attachment edges become assignments, then both are dropped from the
  // canvas graph. The two paths converge on one output shape.
  const securityGroups: SecurityGroupDef[] = []
  const sgIds = new Set<string>()
  const pushSg = (def: SecurityGroupDef) => {
    if (sgIds.has(def.id)) return
    sgIds.add(def.id)
    securityGroups.push(def)
  }
  if (Array.isArray(snap.sg)) {
    for (const item of snap.sg) {
      const def = sanitizeSgDef(item)
      if (def) pushSg(def)
    }
  }
  // Legacy sg nodes → defs, keyed by node id so their attachment edges resolve.
  const legacySgNodeIds = new Set<string>()
  for (const item of snap.nodes) {
    const n = item as Record<string, unknown>
    const data = (n.data ?? {}) as Record<string, unknown>
    if (data.type !== 'sg' || typeof n.id !== 'string') continue
    legacySgNodeIds.add(n.id)
    const cfg = (data.config ?? {}) as Record<string, unknown>
    pushSg({
      id: n.id,
      name: typeof data.label === 'string' ? data.label : n.id,
      allowHttp: cfg.allow_http !== false,
      allowHttps: cfg.allow_https !== false,
      allowSsh: cfg.allow_ssh === true,
    })
  }

  const nodes: ResourceNodeType[] = []
  const ids = new Set<string>()
  // Nodes we drop rather than fail on: resource types cidrunner does not model
  // (e.g. an ECR/CloudTrail from a real exported topology). We skip them, cascade
  // their orphaned children, drop their edges, and report the types so the UI can
  // say what was left out — a single unknown block should never reject the whole
  // import.
  const droppedIds = new Set<string>()
  const unsupportedTypes = new Set<string>()
  // Assignments discovered from legacy `sg → resource` edges: target id → sg ids.
  const legacyAssignments = new Map<string, string[]>()
  for (const item of snap.edges) {
    const e = item as Record<string, unknown>
    if (typeof e.source !== 'string' || typeof e.target !== 'string') continue
    if (!legacySgNodeIds.has(e.source)) continue
    const list = legacyAssignments.get(e.target) ?? []
    if (!list.includes(e.source)) list.push(e.source)
    legacyAssignments.set(e.target, list)
  }

  for (const item of snap.nodes) {
    const n = item as Record<string, unknown>
    const data = (n.data ?? {}) as Record<string, unknown>
    const type = data.type as ResourceType
    // Legacy sg nodes were folded into the collection above — not canvas nodes.
    if (type === 'sg') continue
    if (typeof n.id !== 'string') return null
    // Unknown resource type → skip (don't fail the import); its edges/children
    // are dropped below and the type is reported.
    if (!(type in resources)) {
      droppedIds.add(n.id)
      unsupportedTypes.add(String(type))
      continue
    }
    const pos = (n.position ?? {}) as Record<string, unknown>
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
    // Security-group assignment (ADR 0059): union of v2 config ids and any
    // legacy `sg → this` attachment edges, kept only for SGs that exist.
    const cfg = node.data.config
    const declared = Array.isArray(cfg.securityGroupIds)
      ? cfg.securityGroupIds.filter((v): v is string => typeof v === 'string')
      : []
    const assigned = [...new Set([...declared, ...(legacyAssignments.get(n.id) ?? [])])].filter(
      (sgId) => sgIds.has(sgId),
    )
    if (assigned.length) cfg.securityGroupIds = assigned
    else delete cfg.securityGroupIds
    // Restore a container's size. A NodeResizer resize writes the new dimensions
    // to the node's top-level `width`/`height` (and `measured`) — NOT to `style`
    // — so reading only `style` reverted a resized container to its original
    // created size on reload, clamping its `extent: 'parent'` children into the
    // smaller box (the "sizes reset + resources jumbled after refresh" bug).
    // Prefer the resized top-level/measured size, falling back to the created
    // `style` size. Only containers carry an authored size; leaf cards size to
    // their content, so never pin their dimensions.
    const style = (n.style ?? {}) as Record<string, unknown>
    if (resources[type].container) {
      const measured = (n.measured ?? {}) as Record<string, unknown>
      const w = firstNum(n.width, style.width, measured.width)
      const h = firstNum(n.height, style.height, measured.height)
      if (w !== undefined && h !== undefined) node.style = { width: w, height: h }
    } else if (isNum(style.width) && isNum(style.height)) {
      node.style = { width: style.width, height: style.height }
    }
    nodes.push(node)
  }
  // A node whose parent was dropped (unsupported type) can't be placed — cascade
  // it (and its own children, transitively) into the dropped set rather than
  // failing. Truly dangling parentIds (never present) are dropped the same way.
  let cascaded = true
  while (cascaded) {
    cascaded = false
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]!
      if (n.parentId && !ids.has(n.parentId)) {
        ids.delete(n.id)
        droppedIds.add(n.id)
        nodes.splice(i, 1)
        cascaded = true
      }
    }
  }

  const edges: Edge[] = []
  for (const item of snap.edges) {
    const e = item as Record<string, unknown>
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      return null
    }
    // Legacy sg attachment edges were converted to assignments above — drop them
    // rather than fail the (now sg-node-less) endpoint check.
    if (legacySgNodeIds.has(e.source) || legacySgNodeIds.has(e.target)) continue
    // Endpoint dropped (unsupported node) or never present → skip this edge
    // instead of rejecting the whole design.
    if (!ids.has(e.source) || !ids.has(e.target)) continue
    edges.push({ id: e.id, source: e.source, target: e.target, type: 'traffic' })
  }

  // Mission context is optional; an unknown id is dropped, not fatal.
  const missionId =
    typeof snap.m === 'string' && getMission(snap.m) ? snap.m : undefined

  return { nodes, edges, missionId, securityGroups, unsupportedTypes: [...unsupportedTypes] }
}

/** Parses a design out of `location.hash` (`#g=…`), if present and valid. */
export function designFromHash(hash: string): LoadedDesign | null {
  const match = hash.match(/^#g=(.+)$/)
  if (!match || match[1] === undefined) return null
  const json = b64urlDecode(match[1])
  if (!json) return null
  try {
    return sanitizeSnapshot(JSON.parse(json))
  } catch {
    return null
  }
}
