import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Graph-level CIDR validation (post-MVP hardening). Per-node `validate` only
 * sees one node's config, but CIDR correctness is relational:
 *
 * 1. A subnet's CIDR must be contained within its parent VPC's CIDR.
 * 2. Sibling subnets in the same VPC must not overlap.
 *
 * VPC-to-VPC overlap is intentionally allowed — AWS permits it (it only bites
 * when peering). See ADR 0015.
 */

interface CidrRange {
  /** First address, as an unsigned 32-bit integer. */
  start: number
  /** Last address, inclusive. */
  end: number
}

/** Parses `a.b.c.d/n` into a numeric range; null if malformed. */
export function parseCidr(value: unknown): CidrRange | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
  if (!m) return null
  const octets = [m[1], m[2], m[3], m[4]].map(Number)
  const prefix = Number(m[5])
  if (octets.some((o) => o > 255) || prefix > 32) return null
  // Fold the four octets into a u32 via reduce — avoids indexed access so it
  // stays clean under noUncheckedIndexedAccess.
  const ip = octets.reduce((acc, o) => ((acc << 8) | o) >>> 0, 0) >>> 0
  // Note: JS shifts are mod 32, so /0 needs its own case.
  const size = prefix === 0 ? 0x1_0000_0000 : 2 ** (32 - prefix)
  const start = prefix === 0 ? 0 : (ip & ~((size - 1) >>> 0)) >>> 0
  return { start, end: start + size - 1 }
}

const contains = (outer: CidrRange, inner: CidrRange) =>
  outer.start <= inner.start && inner.end <= outer.end

const overlaps = (a: CidrRange, b: CidrRange) => a.start <= b.end && b.start <= a.end

/**
 * Returns graph-level CIDR error messages per node id. Nodes with malformed
 * CIDRs are skipped here — per-node `validate` already reports those.
 */
export function cidrIssues(nodes: ResourceNodeType[]): Map<string, string[]> {
  const issues = new Map<string, string[]>()
  const add = (id: string, msg: string) => {
    const list = issues.get(id) ?? []
    if (!list.includes(msg)) issues.set(id, [...list, msg])
  }

  // Walk the parent chain to the enclosing VPC. A subnet may sit directly in a
  // VPC or inside an AZ box (ADR 0050), so containment/overlap must key on the
  // enclosing VPC, not the direct parent.
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const enclosingVpc = (n: ResourceNodeType): ResourceNodeType | undefined => {
    let cur = n.parentId ? byId.get(n.parentId) : undefined
    while (cur) {
      if (cur.data.type === 'vpc') return cur
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return undefined
  }

  const subnets = nodes
    .filter((n) => n.data.type === 'subnet')
    .map((n) => ({ node: n, range: parseCidr(n.data.config.cidr_block), vpc: enclosingVpc(n) }))

  // 1. Subnet must fit inside its enclosing VPC's CIDR.
  for (const { node, range, vpc } of subnets) {
    if (!range || !vpc) continue
    const vpcRange = parseCidr(vpc.data.config.cidr_block)
    if (vpcRange && !contains(vpcRange, range)) {
      add(
        node.id,
        `Subnet CIDR(${node.data.config.cidr_block})이 VPC CIDR(${vpc.data.config.cidr_block}) 범위를 벗어납니다.`,
      )
    }
  }

  // 2. Sibling subnets in the same VPC must not overlap.
  for (let i = 0; i < subnets.length; i++) {
    for (let j = i + 1; j < subnets.length; j++) {
      const a = subnets[i]
      const b = subnets[j]
      if (!a || !b || !a.range || !b.range) continue
      if (!a.vpc || a.vpc.id !== b.vpc?.id) continue
      if (overlaps(a.range, b.range)) {
        const msg = (other: ResourceNodeType) =>
          `같은 VPC의 Subnet(${other.data.label}, ${other.data.config.cidr_block})과 CIDR이 겹칩니다.`
        add(a.node.id, msg(b.node))
        add(b.node.id, msg(a.node))
      }
    }
  }

  return issues
}

// Cache per nodes-array identity so many node renderers share one computation.
const cache = new WeakMap<ResourceNodeType[], Map<string, string[]>>()

/** Memoized {@link cidrIssues} keyed on the store's nodes array reference. */
export function getCidrIssues(nodes: ResourceNodeType[]): Map<string, string[]> {
  let result = cache.get(nodes)
  if (!result) {
    result = cidrIssues(nodes)
    cache.set(nodes, result)
  }
  return result
}
