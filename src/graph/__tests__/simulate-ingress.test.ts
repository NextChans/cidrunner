import { describe, expect, it } from 'vitest'
import { simulate } from '@/graph/simulate'
import { E, N } from './helpers'

/**
 * Internet ingress gate (ADR 0039). An internet-facing ALB placed inside a VPC
 * needs an Internet Gateway and a public subnet to be reachable; an internal
 * ALB does not, and a loose ALB with no VPC stays exempt (no regression).
 */
describe('simulate — internet ingress (ADR 0039)', () => {
  /** external ALB in a VPC, with the given extra nodes, wired alb → ec2 → rds. */
  function vpcAlb(extra: ReturnType<typeof N>[], albConfig: Record<string, unknown>) {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('alb-1', 'alb', 'vpc-1', albConfig),
      N('ec2-1', 'ec2', undefined, {}),
      N('rds-1', 'rds', undefined, {}),
      ...extra,
    ]
    const edges = [E('t1', 'alb-1', 'ec2-1'), E('t2', 'ec2-1', 'rds-1')]
    return { nodes, edges }
  }

  it('fails an internet-facing ALB in a VPC with no IGW', () => {
    const { nodes, edges } = vpcAlb(
      [N('subnet-1', 'subnet', 'vpc-1', { public: true })],
      { internal: false, listener_port: 80 },
    )
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(false)
    expect(sim.flows[0]!.blockedNodeId).toBe('alb-1')
    expect(sim.flows[0]!.message).toContain('Internet Gateway')
  })

  it('fails an internet-facing ALB whose VPC has an IGW but no public subnet', () => {
    const { nodes, edges } = vpcAlb(
      [
        N('igw-1', 'igw', 'vpc-1', {}),
        N('subnet-1', 'subnet', 'vpc-1', { public: false }),
      ],
      { internal: false, listener_port: 80 },
    )
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(false)
    expect(sim.flows[0]!.blockedNodeId).toBe('alb-1')
    expect(sim.flows[0]!.message).toContain('퍼블릭 Subnet')
  })

  it('succeeds an internet-facing ALB with IGW + public subnet', () => {
    const { nodes, edges } = vpcAlb(
      [
        N('igw-1', 'igw', 'vpc-1', {}),
        N('subnet-1', 'subnet', 'vpc-1', { public: true }),
      ],
      { internal: false, listener_port: 80 },
    )
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows[0]!.pathNodeIds).toEqual(['alb-1', 'ec2-1', 'rds-1'])
  })

  it('exempts an internal ALB (no IGW required)', () => {
    const { nodes, edges } = vpcAlb(
      [N('subnet-1', 'subnet', 'vpc-1', { public: false })],
      { internal: true, listener_port: 80 },
    )
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows[0]!.pathNodeIds).toEqual(['alb-1', 'ec2-1', 'rds-1'])
  })

  it('exempts a loose ALB with no enclosing VPC (regression guard)', () => {
    const sim = simulate(
      [N('alb-1', 'alb'), N('ec2-1', 'ec2'), N('rds-1', 'rds')],
      [E('t1', 'alb-1', 'ec2-1'), E('t2', 'ec2-1', 'rds-1')],
    )
    expect(sim.ok).toBe(true)
  })

  it('blocks at the ALB when a CloudFront-fed external ALB lacks an IGW', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { public: true }),
      N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80 }),
      N('ec2-1', 'ec2', undefined, {}),
      N('rds-1', 'rds', undefined, {}),
      N('cloudfront-1', 'cloudfront', undefined, {}),
    ]
    const edges = [
      E('o1', 'cloudfront-1', 'alb-1'),
      E('t1', 'alb-1', 'ec2-1'),
      E('t2', 'ec2-1', 'rds-1'),
    ]
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(false)
    expect(sim.flows[0]!.blockedNodeId).toBe('alb-1')
    expect(sim.flows[0]!.pathNodeIds).toEqual(['cloudfront-1', 'alb-1'])
    expect(sim.flows[0]!.message).toContain('Internet Gateway')
  })
})
