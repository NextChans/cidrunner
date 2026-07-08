import { describe, expect, it } from 'vitest'
import { simulate } from '@/graph/simulate'
import { E, N } from './helpers'

/**
 * Simulation robustness (Sprint A coverage): the greedy tracer must terminate on
 * cyclic graphs, choose deterministically when an entry branches, and treat SG
 * edges as attachments rather than as an inbound that disqualifies an entry.
 */
describe('simulate — traversal safety', () => {
  it('terminates on a cycle and blocks instead of looping forever', () => {
    // alb → a → b → a (back edge). The visited-set must stop the loop.
    const sim = simulate(
      [N('alb1', 'alb'), N('a', 'ec2'), N('b', 'ec2')],
      [E('e1', 'alb1', 'a'), E('e2', 'a', 'b'), E('e3', 'b', 'a')],
    )
    expect(sim.ok).toBe(false)
    expect(sim.flows[0]!.blockedNodeId).toBe('b')
    expect(sim.flows[0]!.pathNodeIds).toEqual(['alb1', 'a', 'b'])
  })

  it('follows the first outgoing edge when an entry branches', () => {
    // Two outgoing edges from the ALB; the first in the list wins.
    const viaEc2 = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2'), N('s31', 's3'), N('rds1', 'rds')],
      [E('e1', 'alb1', 'ec21'), E('e2', 'alb1', 's31'), E('e3', 'ec21', 'rds1')],
    )
    expect(viaEc2.flows[0]!.pathNodeIds).toEqual(['alb1', 'ec21', 'rds1'])

    const viaS3 = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2'), N('s31', 's3'), N('rds1', 'rds')],
      [E('e1', 'alb1', 's31'), E('e2', 'alb1', 'ec21'), E('e3', 'ec21', 'rds1')],
    )
    expect(viaS3.flows[0]!.pathNodeIds).toEqual(['alb1', 's31'])
  })

  it('an SG-only inbound does not disqualify an ALB from being an entry', () => {
    // sg → alb is an attachment; the ALB is still the traffic entry (and here,
    // blocked because it has no traffic target).
    const sim = simulate(
      [N('sg1', 'sg'), N('alb1', 'alb')],
      [E('a1', 'sg1', 'alb1')],
    )
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0]!.entryId).toBe('alb1')
    expect(sim.flows[0]!.blockedNodeId).toBe('alb1')
  })

  it('aggregates blocked ids and keeps ok=false when any flow fails', () => {
    const sim = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2'), N('rds1', 'rds'), N('alb2', 'alb')],
      [E('e1', 'alb1', 'ec21'), E('e2', 'ec21', 'rds1')],
    )
    expect(sim.ok).toBe(false)
    expect(sim.blockedNodeIds).toContain('alb2')
    expect(sim.flows.filter((f) => f.ok)).toHaveLength(1)
  })
})
