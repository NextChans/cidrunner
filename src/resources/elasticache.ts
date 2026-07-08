import { MemoryStick } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * ElastiCache — an in-memory cache (Redis / Valkey) that sits in front of a
 * database, the RDS counterpart on the data tier (ADR 0026). Lives in a subnet
 * and, like RDS, needs a subnet group spanning ≥2 AZs (emitted by the graph
 * generator). A single-node cluster keeps the export cheap and apply-ready.
 */
export const elasticache: ResourceMeta = {
  type: 'elasticache',
  label: 'ElastiCache',
  description: '인메모리 캐시 (Redis/Valkey)',
  category: 'database',
  icon: MemoryStick,
  color: 'text-red-300',
  defaults: {
    engine: 'redis',
    node_type: 'cache.t3.micro',
  },
  // A cache cluster lives inside a (private) subnet, like RDS.
  allowedParents: ['subnet'],
  fields: [
    {
      key: 'engine',
      label: '엔진',
      type: 'select',
      options: [
        { value: 'redis', label: 'Redis' },
        { value: 'valkey', label: 'Valkey' },
      ],
    },
    {
      key: 'node_type',
      label: '노드 타입',
      type: 'select',
      options: [
        { value: 'cache.t3.micro', label: 'cache.t3.micro' },
        { value: 'cache.t3.small', label: 'cache.t3.small' },
        { value: 'cache.r7g.large', label: 'cache.r7g.large' },
      ],
    },
  ],
  // The generator emits an aws_elasticache_subnet_group per VPC hosting a cache.
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const engine = config.engine === 'valkey' ? 'valkey' : 'redis'
    const sgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`)
    const sgLine = sgs.length ? `\n  security_group_ids   = [${sgs.join(', ')}]` : ''
    const subnetGroup = refs.vpc
      ? `\n  subnet_group_name    = aws_elasticache_subnet_group.${refs.vpc}_cachesg.name`
      : ''
    // Cluster ids are lowercase, ≤50 chars, and must start with a letter.
    const clusterId = `${awsName.toLowerCase().slice(0, 45)}`
    return `resource "aws_elasticache_cluster" "${name}" {
  cluster_id           = "${clusterId}"
  engine               = "${engine}"
  node_type            = "${config.node_type ?? 'cache.t3.micro'}"
  num_cache_nodes      = 1
  port                 = 6379${subnetGroup}${sgLine}
  tags = { Name = "${displayName}" }
}`
  },
}
