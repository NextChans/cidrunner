import { describe, expect, it } from 'vitest'
import { estimateMonthlyCost, nodeMonthlyCost } from '@/graph/cost'
import { getMission } from '@/missions'
import { N } from './helpers'

describe('cost — monthly estimate (ADR 0051)', () => {
  it('prices the hourly billers and treats plumbing/boxes as free', () => {
    expect(nodeMonthlyCost(N('nat-1', 'nat'))).toBe(32)
    expect(nodeMonthlyCost(N('alb-1', 'alb'))).toBe(16)
    // EKS = control plane (73) + 2 worker nodes; default t3.medium → 73 + 2×30.
    expect(nodeMonthlyCost(N('eks-1', 'eks'))).toBe(133)
    expect(nodeMonthlyCost(N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }))).toBe(0)
    expect(nodeMonthlyCost(N('subnet-1', 'subnet'))).toBe(0)
    expect(nodeMonthlyCost(N('igw-1', 'igw'))).toBe(0)
    expect(nodeMonthlyCost(N('account-1', 'account'))).toBe(0)
    expect(nodeMonthlyCost(N('az-1', 'az'))).toBe(0)
  })

  it('scales EC2 by instance type and doubles RDS for multi-AZ', () => {
    expect(nodeMonthlyCost(N('ec2-1', 'ec2', undefined, { instance_type: 't3.micro' }))).toBe(8)
    expect(nodeMonthlyCost(N('ec2-2', 'ec2', undefined, { instance_type: 'm5.large' }))).toBe(70)
    const single = nodeMonthlyCost(N('rds-1', 'rds', undefined, { instance_class: 'db.t3.micro' }))
    const multi = nodeMonthlyCost(
      N('rds-2', 'rds', undefined, { instance_class: 'db.t3.micro', multi_az: true }),
    )
    expect(single).toBe(13)
    expect(multi).toBe(26)
  })

  it('sums and rounds the whole graph', () => {
    const total = estimateMonthlyCost([
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('nat-1', 'nat'),
      N('alb-1', 'alb'),
      N('ec2-1', 'ec2', undefined, { instance_type: 't3.micro' }),
    ])
    expect(total).toBe(56) // 0 + 32 + 16 + 8
  })

  it('keeps a mission with a budget achievable at its clean cost point', () => {
    // A budget must not be tighter than the intended minimal build: three-tier's
    // canonical cost is ALB(16) + EC2 t3.micro(8) + RDS multi-AZ(26) = 50 ≤ 60.
    const threeTier = getMission('three-tier')
    expect(threeTier?.budget).toBeGreaterThanOrEqual(50)
    const cleanCost = estimateMonthlyCost([
      N('alb-7', 'alb'),
      N('ec2-8', 'ec2', undefined, { instance_type: 't3.micro' }),
      N('rds-9', 'rds', undefined, { instance_class: 'db.t3.micro', multi_az: true }),
    ])
    expect(cleanCost).toBeLessThanOrEqual(threeTier!.budget!)
  })
})
