import type { ResourceNodeType } from '@/store/useGraphStore'
import type { ResourceType } from '@/resources/types'
import { parseCidr } from './cidr'

/**
 * Container-inherited defaults (ADR 0050). When a node is created inside a box,
 * it picks up sensible defaults from its container chain — applied ONCE at
 * creation and freely editable afterward:
 *
 * - a **Subnet** carves the next free `/24` from its enclosing VPC's CIDR (so
 *   sibling subnets never collide on the default), and inherits its `az` from an
 *   enclosing AZ box when present;
 * - an **AZ box** defaults to the next unused AZ letter among its sibling AZ
 *   boxes in the same VPC.
 *
 * `node` must already carry its `parentId`; `nodes` is the existing graph (the
 * new node is not yet part of it). The node's `data.config` is mutated in place.
 */

const AZ_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export function applyInheritedDefaults(
  node: ResourceNodeType,
  nodes: ResourceNodeType[],
): void {
  if (!node.parentId) return
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const ancestorOf = (type: ResourceType): ResourceNodeType | undefined => {
    let cur = byId.get(node.parentId!)
    while (cur) {
      if (cur.data.type === type) return cur
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return undefined
  }
  const enclosingVpcId = (n: ResourceNodeType): string | undefined => {
    let cur = n.parentId ? byId.get(n.parentId) : undefined
    while (cur) {
      if (cur.data.type === 'vpc') return cur.id
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return undefined
  }

  if (node.data.type === 'subnet') {
    const azBox = ancestorOf('az')
    if (azBox && typeof azBox.data.config.az === 'string') {
      node.data.config.az = azBox.data.config.az
    }
    const vpc = ancestorOf('vpc')
    const vpcRange = vpc ? parseCidr(vpc.data.config.cidr_block) : null
    if (vpc && vpcRange) {
      const base = vpcRange.start
      const blocks = (vpcRange.end - vpcRange.start + 1) >>> 8 // number of /24s in the VPC
      const used = new Set<number>()
      for (const n of nodes) {
        if (n.data.type !== 'subnet' || enclosingVpcId(n) !== vpc.id) continue
        const r = parseCidr(n.data.config.cidr_block)
        if (r) used.add((r.start - base) >>> 8)
      }
      for (let i = 0; i < blocks; i++) {
        if (used.has(i)) continue
        const ip = (base + (i << 8)) >>> 0
        node.data.config.cidr_block = `${ip >>> 24}.${(ip >>> 16) & 255}.${(ip >>> 8) & 255}.${ip & 255}/24`
        break
      }
    }
  }

  if (node.data.type === 'az') {
    const vpc = ancestorOf('vpc')
    if (vpc) {
      const used = new Set(
        nodes
          .filter((n) => n.data.type === 'az' && enclosingVpcId(n) === vpc.id)
          .map((n) => String(n.data.config.az)),
      )
      const next = AZ_LETTERS.find((l) => !used.has(l))
      if (next) node.data.config.az = next
    }
  }
}
