import { describe, expect, it } from 'vitest'
import { graphAzs, deadNodesForAz, applyAzFault } from '@/graph/chaos'
import { simulate } from '@/graph/simulate'
import { E, N } from './helpers'

/**
 * Chaos mode (ADR 0052): downing an AZ knocks out its resources; a single-AZ
 * design dies, a redundant / Multi-AZ one survives — the counterweight to Budget.
 */
describe('chaos — AZ fault injection', () => {
  it('lists the distinct AZs from subnets and AZ boxes', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a' }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b' }),
      N('az-c', 'az', 'vpc-1', { az: 'c' }),
    ]
    expect(graphAzs(nodes)).toEqual(['a', 'b', 'c'])
  })

  it('kills resources pinned to the AZ but spares a Multi-AZ RDS', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s-a', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a' }),
      N('ec2-a', 'ec2', 's-a', { instance_type: 't3.micro' }),
      N('rds-single', 'rds', 's-a', { instance_class: 'db.t3.micro' }),
      N('rds-multi', 'rds', 's-a', { instance_class: 'db.t3.micro', multi_az: true }),
      N('s-b', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b' }),
      N('ec2-b', 'ec2', 's-b', { instance_type: 't3.micro' }),
    ]
    const dead = deadNodesForAz(nodes, 'a')
    expect(dead.has('s-a')).toBe(true)
    expect(dead.has('ec2-a')).toBe(true)
    expect(dead.has('rds-single')).toBe(true)
    expect(dead.has('rds-multi')).toBe(false) // failover survives
    expect(dead.has('ec2-b')).toBe(false)
    expect(dead.has('s-b')).toBe(false)
  })

  it('a single-AZ design goes down when its AZ fails', () => {
    const nodes = [
      N('alb', 'alb'),
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s-a', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a' }),
      N('ec2', 'ec2', 's-a', {}),
      N('rds', 'rds', 's-a', { instance_class: 'db.t3.micro' }),
    ]
    const edges = [E('t1', 'alb', 'ec2'), E('t2', 'ec2', 'rds')]
    expect(simulate(nodes, edges).ok).toBe(true) // healthy before the fault
    const down = simulate(nodes, edges, { deadNodeIds: deadNodesForAz(nodes, 'a') })
    expect(down.ok).toBe(false) // EC2 + RDS gone → no path
    expect(down.deadNodeIds).toContain('ec2')
  })

  it('flags a Multi-AZ RDS as failed-over (survives, same endpoint), no promotion', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s-a', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a' }),
      N('s-c', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'c' }),
      N('master', 'rds', 's-a', { instance_class: 'db.t3.micro', multi_az: true }),
      N('replica', 'rds', 's-c', { instance_class: 'db.t3.micro' }),
    ]
    const edges = [E('r', 'master', 'replica')]
    const fault = applyAzFault(nodes, edges, 'a')
    expect(fault.failoverIds).toContain('master')
    expect(fault.deadNodeIds.has('master')).toBe(false) // survives
    expect(fault.promotedIds).toEqual([]) // Multi-AZ needs no promotion
  })

  it('promotes a read replica and reroutes traffic when a single-AZ master dies', () => {
    const nodes = [
      N('alb', 'alb'),
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s-a', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a' }),
      N('s-c', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'c' }),
      N('ec2c', 'ec2', 's-c', {}),
      N('master', 'rds', 's-a', { instance_class: 'db.t3.micro' }), // single-AZ, in AZ-a
      N('replica', 'rds', 's-c', { instance_class: 'db.t3.micro' }), // read replica in AZ-c
    ]
    const edges = [
      E('t1', 'alb', 'ec2c'),
      E('t2', 'ec2c', 'master'), // app writes to the master
      E('rep', 'master', 'replica'), // replication edge
    ]
    const fault = applyAzFault(nodes, edges, 'a')
    expect(fault.deadNodeIds.has('master')).toBe(true) // single-AZ master dies with AZ-a
    expect(fault.promotedIds).toContain('replica')
    // The app→master traffic edge is redirected to the promoted replica.
    const t2 = fault.edges.find((e) => e.id === 't2')
    expect(t2?.target).toBe('replica')

    // End to end: the flow now reaches the promoted replica.
    const sim = simulate(nodes, fault.edges, {
      deadNodeIds: fault.deadNodeIds,
      promotedIds: fault.promotedIds,
    })
    expect(sim.ok).toBe(true)
    expect(sim.pathNodeIds).toContain('replica')
    expect(sim.promotedNodeIds).toContain('replica')
  })

  it('a redundant (2-AZ + Multi-AZ RDS) design survives an AZ failure', () => {
    const nodes = [
      N('alb', 'alb'),
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s-a', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a' }),
      N('s-b', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b' }),
      N('ec2-a', 'ec2', 's-a', {}),
      N('ec2-b', 'ec2', 's-b', {}),
      N('rds', 'rds', 's-a', { instance_class: 'db.t3.micro', multi_az: true }),
    ]
    const edges = [
      E('la', 'alb', 'ec2-a'),
      E('lb', 'alb', 'ec2-b'),
      E('da', 'ec2-a', 'rds'),
      E('db', 'ec2-b', 'rds'),
    ]
    const down = simulate(nodes, edges, { deadNodeIds: deadNodesForAz(nodes, 'a') })
    expect(down.ok).toBe(true) // ALB → EC2-b → (Multi-AZ) RDS still reaches
  })
})
