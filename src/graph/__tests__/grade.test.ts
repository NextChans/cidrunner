import { describe, expect, it } from 'vitest'
import { wellArchitectedGrade } from '@/graph/grade'
import { nodeMonthlyCost } from '@/graph/cost'
import { E, N } from './helpers'

/** A resilient 2-AZ 3-tier: ALB → EC2(a,c) → Multi-AZ RDS, SGs attached. */
function resilientBuild() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('pa', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    N('pc', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'c', public: true }),
    N('da', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
    N('dc', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'c', public: false }),
    N('igw', 'igw', 'vpc-1', {}),
    N('sg', 'sg', 'vpc-1', { allow_http: true, allow_https: true, allow_ssh: false }),
    N('alb', 'alb', 'vpc-1', { internal: false, listener_port: 80 }),
    N('ec2a', 'ec2', 'da', { instance_type: 't3.micro', ami: 'auto' }),
    N('ec2c', 'ec2', 'dc', { instance_type: 't3.micro', ami: 'auto' }),
    N('rds', 'rds', 'da', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true, multi_az: true }),
  ]
  const edges = [
    E('s1', 'sg', 'alb'), E('s2', 'sg', 'ec2a'), E('s3', 'sg', 'ec2c'), E('s4', 'sg', 'rds'),
    E('l1', 'alb', 'ec2a'), E('l2', 'alb', 'ec2c'), E('d1', 'ec2a', 'rds'), E('d2', 'ec2c', 'rds'),
  ]
  return { nodes, edges }
}

describe('grade — Well-Architected (ADR 0054)', () => {
  it('grades an empty canvas D', () => {
    expect(wellArchitectedGrade([], []).letter).toBe('D')
  })

  it('scores a resilient, secure, wired 2-AZ 3-tier highly', () => {
    const { nodes, edges } = resilientBuild()
    const g = wellArchitectedGrade(nodes, edges)
    expect(g.pillars.security).toBe(100) // no warnings
    expect(g.pillars.reliability).toBeGreaterThanOrEqual(85) // survives an AZ failure
    expect(g.pillars.cost).toBe(100) // nothing idle
    expect(['S', 'A']).toContain(g.letter)
  })

  it('drops reliability when the DB is single-AZ (dies on AZ failure)', () => {
    const { nodes, edges } = resilientBuild()
    const single = nodes.map((n) =>
      n.id === 'rds' ? { ...n, data: { ...n.data, config: { ...n.data.config, multi_az: false } } } : n,
    )
    const g = wellArchitectedGrade(single, edges)
    const base = wellArchitectedGrade(nodes, edges)
    expect(g.pillars.reliability).toBeLessThan(base.pillars.reliability)
  })

  it('penalizes cost for an idle expensive resource', () => {
    const { nodes, edges } = resilientBuild()
    const withIdleEks = [
      ...nodes,
      N('eks-idle', 'eks', 'vpc-1', { k8s_version: '1.31', node_instance_type: 't3.medium' }),
    ]
    // eks-idle has no edges → cost efficiency drops.
    expect(wellArchitectedGrade(withIdleEks, edges).pillars.cost).toBeLessThan(100)
  })
})

describe('cost — EKS includes its node group (ADR 0026/0054)', () => {
  it('prices EKS as control plane + 2 worker nodes', () => {
    // 73 control plane + 2 × t3.medium(30) = 133
    expect(nodeMonthlyCost(N('eks-1', 'eks', undefined, { node_instance_type: 't3.medium' }))).toBe(133)
    // 73 + 2 × m5.large(70) = 213
    expect(nodeMonthlyCost(N('eks-2', 'eks', undefined, { node_instance_type: 'm5.large' }))).toBe(213)
  })
})
