import { describe, expect, it } from 'vitest'
import { graphIssues } from '@/graph/checks'
import { bestPracticeTopology, E, N } from './helpers'

describe('graphIssues', () => {
  it('passes a best-practice topology with zero errors and warnings', () => {
    const { nodes, edges, securityGroups } = bestPracticeTopology()
    const issues = graphIssues(nodes, edges, securityGroups)
    expect(issues.errors.size).toBe(0)
    expect(issues.warnings.size).toBe(0)
  })

  it('errors on a NAT outside a public subnet', () => {
    const issues = graphIssues(
      [
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
        N('nat-1', 'nat', 's1'),
      ],
      [],
    )
    expect(issues.errors.get('nat-1')?.[0]).toContain('퍼블릭 Subnet')
  })

  it('errors on ALB/RDS without two subnets in distinct AZs', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80 }),
      N('rds-1', 'rds', 's1', { engine: 'mysql' }),
    ]
    const issues = graphIssues(nodes, [])
    expect(issues.errors.get('alb-1')?.[0]).toContain('2개')
    expect(issues.errors.get('rds-1')?.[0]).toContain('2개')
  })

  it('warns on insecure configuration', () => {
    // SSH-open now lives on the SG def and surfaces on each wearing resource
    // (ADR 0059): rds-1 wears an SSH-open SG, so its warning list carries it.
    const issues = graphIssues(
      [
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
        N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
        N('rds-1', 'rds', 's1', {
          engine: 'mysql',
          storage_encrypted: false,
          securityGroupIds: ['sg-1'],
        }),
        N('s3-1', 's3', undefined, { encryption: false, block_public_access: false }),
      ],
      [],
      [{ id: 'sg-1', name: 'SG', allowHttp: true, allowHttps: true, allowSsh: true }],
    )
    expect(issues.warnings.get('rds-1')?.join()).toContain('SSH')
    expect(issues.warnings.get('rds-1')?.join()).toContain('퍼블릭 Subnet')
    expect(issues.warnings.get('rds-1')?.join()).toContain('암호화')
    expect(issues.warnings.get('s3-1')?.join()).toContain('퍼블릭 액세스')
  })

  it('warns (not errors) when two VPCs share overlapping CIDRs', () => {
    const issues = graphIssues(
      [
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('vpc-2', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('vpc-3', 'vpc', undefined, { cidr_block: '172.16.0.0/16' }),
      ],
      [],
    )
    expect(issues.errors.size).toBe(0)
    expect(issues.warnings.get('vpc-1')?.join()).toContain('피어링')
    expect(issues.warnings.get('vpc-2')?.join()).toContain('겹칩니다')
    expect(issues.warnings.has('vpc-3')).toBe(false)
  })

  it('validates replication links: engine mismatch is an error, same AZ a warning', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
      N('rds-1', 'rds', 's1', { engine: 'mysql' }),
      N('rds-2', 'rds', 's1', { engine: 'postgres' }),
    ]
    const issues = graphIssues(nodes, [E('r1', 'rds-1', 'rds-2')])
    expect(issues.errors.get('rds-2')?.join()).toContain('같은 엔진')
    expect(issues.warnings.get('rds-2')?.join()).toContain('같은 AZ')
  })
})
