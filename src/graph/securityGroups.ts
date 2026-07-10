import type { Edge } from '@xyflow/react'
import type { ResourceType } from '@/resources/types'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Resource types that own ENIs and therefore wear Security Groups (ADR 0042/0059).
 * Lambda is absent — this game models it as a non-VPC, canvas-level function.
 */
export const SG_ASSIGNABLE: readonly ResourceType[] = [
  'alb',
  'ec2',
  'rds',
  'ecs',
  'eks',
  'elasticache',
  'efs',
]

/** True if a resource type can be assigned Security Groups. */
export function isSgAssignable(type: ResourceType): boolean {
  return SG_ASSIGNABLE.includes(type)
}

/**
 * Security Group model (ADR 0059). A Security Group is NOT a canvas node wired
 * with an edge — that read like traffic/flow and misrepresented AWS, where an
 * SG is a firewall *ruleset assigned to a resource's ENIs* (many-to-many). So
 * SGs live in a store-level collection ({@link SecurityGroupDef}) and each
 * resource records the ids it wears in `config.securityGroupIds`.
 *
 * The Terraform generator still speaks the older node+edge language, so rather
 * than rewrite it (and its tests), {@link materializeSecurityGroups} projects
 * the collection + assignments back into synthetic `sg` nodes and `sg → target`
 * attachment edges at the export boundary only.
 */
export interface SecurityGroupDef {
  /** Stable id, also the Terraform local name source (e.g. `sg-1`). */
  id: string
  /** Player-facing name (Terraform `tags.Name`). */
  name: string
  allowHttp: boolean
  allowHttps: boolean
  allowSsh: boolean
}

/** The security-group ids a resource node wears (empty when unset). */
export function assignedSgIds(node: ResourceNodeType): string[] {
  const raw = node.data.config.securityGroupIds
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
}

/** A blank SG def with a monotonic default name. */
export function makeSecurityGroup(id: string, index: number): SecurityGroupDef {
  return { id, name: `보안 그룹 ${index}`, allowHttp: true, allowHttps: true, allowSsh: false }
}

/**
 * Projects the SG collection + per-resource assignments into synthetic `sg`
 * nodes and `sg → resource` attachment edges so the existing edge-driven
 * Terraform generator (attachedSGs / sgIngressFor) works unchanged. Export-only
 * — these synthetic nodes never enter the store or the canvas.
 *
 * Each synthetic SG node is parented to the VPC of its first assigned resource
 * so `vpc_id` resolves via the generator's ancestor walk. SGs with no
 * assignments are dropped (an unassigned SG emits nothing meaningful).
 */
export function materializeSecurityGroups(
  nodes: ResourceNodeType[],
  edges: Edge[],
  securityGroups: SecurityGroupDef[],
): { nodes: ResourceNodeType[]; edges: Edge[] } {
  if (securityGroups.length === 0) return { nodes, edges }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const enclosingVpcId = (nodeId: string): string | undefined => {
    let cur = byId.get(nodeId)
    while (cur) {
      if (cur.data.type === 'vpc') return cur.id
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return undefined
  }

  const synthNodes: ResourceNodeType[] = []
  const synthEdges: Edge[] = []
  for (const sg of securityGroups) {
    const members = nodes.filter((n) => assignedSgIds(n).includes(sg.id))
    if (members.length === 0) continue
    const vpcId = members.map((m) => enclosingVpcId(m.id)).find((v) => v !== undefined)
    const node: ResourceNodeType = {
      id: sg.id,
      type: 'resource',
      position: { x: 0, y: 0 },
      data: {
        type: 'sg',
        label: sg.name,
        config: { allow_http: sg.allowHttp, allow_https: sg.allowHttps, allow_ssh: sg.allowSsh },
      },
    }
    if (vpcId) {
      node.parentId = vpcId
      node.extent = 'parent'
    }
    synthNodes.push(node)
    for (const m of members) {
      synthEdges.push({ id: `sgattach-${sg.id}-${m.id}`, source: sg.id, target: m.id, type: 'traffic' })
    }
  }

  return { nodes: [...nodes, ...synthNodes], edges: [...edges, ...synthEdges] }
}
