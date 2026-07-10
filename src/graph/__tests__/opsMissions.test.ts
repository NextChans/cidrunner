import { describe, expect, it } from 'vitest'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import { estimateMonthlyCost } from '@/graph/cost'
import { getMission } from '@/missions'
import type { MissionCheckContext } from '@/missions/types'
import type { Edge } from '@xyflow/react'
import type { ResourceNodeType } from '@/store/useGraphStore'
import { E, N } from './helpers'

/** Builds a full MissionCheckContext for mission-star assertions. */
function ctxOf(
  nodes: ResourceNodeType[],
  edges: Edge[],
  overrides: Partial<Pick<MissionCheckContext, 'allValid' | 'securityOk'>> = {},
): MissionCheckContext {
  return {
    nodes,
    edges,
    securityGroups: [],
    sim: simulate(nodes, edges),
    allValid: overrides.allValid ?? true,
    securityOk: overrides.securityOk ?? true,
    issues: graphIssues(nodes, edges),
  }
}

/** Dual-AZ 3-tier: compute replicated across AZs, Multi-AZ RDS. */
function dualAzThreeTier() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.11.0/24', az: 'a', public: false }),
    N('igw-1', 'igw', 'vpc-1'),
    N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80 }),
    N('ec2-a', 'ec2', 'subnet-1', { instance_type: 't3.micro', ami: 'auto' }),
    N('ec2-b', 'ec2', 'subnet-2', { instance_type: 't3.micro', ami: 'auto' }),
    N(
      'rds-1',
      'rds',
      'subnet-3',
      { engine: 'mysql', instance_class: 'db.t3.micro', multi_az: true },
      'Main DB',
    ),
  ]
  const edges = [
    E('t1', 'alb-1', 'ec2-a'),
    E('t2', 'alb-1', 'ec2-b'),
    E('t3', 'ec2-a', 'rds-1'),
    E('t4', 'ec2-b', 'rds-1'),
  ]
  return { nodes, edges }
}

describe('ops-challenge missions (ADR 0057)', () => {
  it('ha-survival: dual-AZ + Multi-AZ RDS build earns all three stars', () => {
    const { nodes, edges } = dualAzThreeTier()
    // Sanity: this build is affordable (ALB 16 + 2×EC2 8 + RDS 13×2 = $58).
    expect(estimateMonthlyCost(nodes)).toBeLessThanOrEqual(90)
    expect(getMission('ha-survival')!.check!(ctxOf(nodes, edges))).toBe(3)
  })

  it('ha-survival: a working single-AZ build stops at one star', () => {
    const { nodes, edges } = dualAzThreeTier()
    const singleAz = nodes.map((n) =>
      n.data.type === 'subnet'
        ? { ...n, data: { ...n.data, config: { ...n.data.config, az: 'a' } } }
        : n.data.type === 'rds'
          ? { ...n, data: { ...n.data, config: { ...n.data.config, multi_az: false } } }
          : n,
    )
    const stars = getMission('ha-survival')!.check!(ctxOf(singleAz, edges))
    expect(stars).toBe(1) // chain works, but AZ-a failure kills everything
  })

  it('ha-survival: survival via read-replica promotion also passes the chaos gate', () => {
    const { nodes, edges } = dualAzThreeTier()
    // Single-AZ master in AZ-a + replica in AZ-b (instead of Multi-AZ).
    const withReplica = [
      ...nodes.map((n) =>
        n.data.type === 'rds'
          ? { ...n, data: { ...n.data, config: { ...n.data.config, multi_az: false } } }
          : n,
      ),
      N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.12.0/24', az: 'b', public: false }),
      N(
        'rds-2',
        'rds',
        'subnet-4',
        { engine: 'mysql', instance_class: 'db.t3.micro', multi_az: false },
        'Replica',
      ),
    ]
    const withReplEdges = [...edges, E('r1', 'rds-1', 'rds-2')]
    const stars = getMission('ha-survival')!.check!(ctxOf(withReplica, withReplEdges))
    expect(stars).toBeGreaterThanOrEqual(2) // AZ-a death promotes the replica
  })

  it('ha-survival: blowing the budget costs the third star, not survival', () => {
    const { nodes, edges } = dualAzThreeTier()
    const gilded = [
      ...nodes,
      N('nat-1', 'nat', 'subnet-1'),
      N('nat-2', 'nat', 'subnet-2'),
    ] // +$64 of NAT → over $90
    expect(estimateMonthlyCost(gilded)).toBeGreaterThan(90)
    expect(getMission('ha-survival')!.check!(ctxOf(gilded, edges))).toBe(2)
  })

  it('lean-serverless: serverless chain under $5 earns the stars', () => {
    const nodes = [
      N('apigw-1', 'apigw', undefined, {}),
      N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('dynamodb-1', 'dynamodb', undefined, { billing_mode: 'PAY_PER_REQUEST', hash_key: 'id' }),
    ]
    const edges = [E('e1', 'apigw-1', 'lambda-1'), E('e2', 'lambda-1', 'dynamodb-1')]
    expect(estimateMonthlyCost(nodes)).toBeLessThanOrEqual(5)
    expect(getMission('lean-serverless')!.check!(ctxOf(nodes, edges))).toBe(3)
    // Security warnings cost the third star only.
    expect(
      getMission('lean-serverless')!.check!(ctxOf(nodes, edges, { securityOk: false })),
    ).toBe(2)
  })

  it('lean-serverless: an hourly-billed block busts the budget star', () => {
    const nodes = [
      N('apigw-1', 'apigw', undefined, {}),
      N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('dynamodb-1', 'dynamodb', undefined, { billing_mode: 'PAY_PER_REQUEST', hash_key: 'id' }),
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('nat-1', 'nat', 'subnet-1'),
    ]
    const edges = [E('e1', 'apigw-1', 'lambda-1'), E('e2', 'lambda-1', 'dynamodb-1')]
    expect(estimateMonthlyCost(nodes)).toBeGreaterThan(5)
    // Stars gate sequentially: the busted budget caps the mission at ★1 even
    // though security is clean — frugality IS this mission.
    expect(getMission('lean-serverless')!.check!(ctxOf(nodes, edges))).toBe(1)
  })
})
