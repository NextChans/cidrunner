import { describe, expect, it } from 'vitest'
import { simulate } from '@/graph/simulate'
import { bestPracticeTopology, E, N } from './helpers'

describe('simulate', () => {
  it('traces a 3-tier path to the database', () => {
    const nodes = [N('alb1', 'alb'), N('ec21', 'ec2'), N('rds1', 'rds')]
    const edges = [E('e1', 'alb1', 'ec21'), E('e2', 'ec21', 'rds1')]
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0].pathNodeIds).toEqual(['alb1', 'ec21', 'rds1'])
    expect(sim.flows[0].pathEdgeIds).toEqual(['e1', 'e2'])
  })

  it('reports the blocking node when the path breaks', () => {
    const sim = simulate([N('alb1', 'alb'), N('ec21', 'ec2')], [E('e1', 'alb1', 'ec21')])
    expect(sim.ok).toBe(false)
    expect(sim.flows[0].blockedNodeId).toBe('ec21')
    expect(sim.blockedNodeIds).toContain('ec21')
  })

  it('fails with guidance when there is no entry point', () => {
    const sim = simulate([N('rds1', 'rds')], [])
    expect(sim.ok).toBe(false)
    expect(sim.flows).toHaveLength(0)
    expect(sim.message).toContain('진입점')
  })

  it('traces one flow per entry (multi-flow)', () => {
    const { nodes, edges } = bestPracticeTopology()
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(2)
    const labels = sim.flows.map((f) => f.label)
    expect(labels.join('|')).toContain('Web ALB')
    expect(labels.join('|')).toContain('API Fn')
  })

  it('ignores SG attachment edges and RDS replication edges as traffic', () => {
    // SG edge into a lambda must not disqualify it as an entry.
    const sgCase = simulate(
      [N('sg1', 'sg'), N('lam1', 'lambda'), N('s31', 's3')],
      [E('a', 'sg1', 'lam1'), E('t', 'lam1', 's31')],
    )
    expect(sgCase.ok).toBe(true)

    // A replication edge must not extend a traffic path beyond the primary.
    const repl = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2'), N('rds1', 'rds'), N('rds2', 'rds')],
      [E('e1', 'alb1', 'ec21'), E('e2', 'ec21', 'rds1'), E('r1', 'rds1', 'rds2')],
    )
    expect(repl.ok).toBe(true)
    expect(repl.flows[0].pathNodeIds).toEqual(['alb1', 'ec21', 'rds1'])
  })

  it('computes hop-staggered arrivals along the path', () => {
    const { nodes, edges } = bestPracticeTopology()
    const sim = simulate(nodes, edges)
    expect(sim.arrivals['alb-8']).toBe(0)
    expect(sim.arrivals['rds-10']).toBeCloseTo(0.9)
    expect(sim.edgeHops['t2']).toBe(1)
  })
})
