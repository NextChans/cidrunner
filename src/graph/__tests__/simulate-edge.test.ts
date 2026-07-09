import { describe, expect, it } from 'vitest'
import { simulate } from '@/graph/simulate'
import { E, N } from './helpers'

/**
 * Simulation traversal (redesigned for ADR 0047 / QA-002). The tracer now does a
 * depth-first search with backtracking, so a flow succeeds when *any* path from
 * the entry reaches a sink. These lock in that behaviour: it must still terminate
 * on cycles, find a completed branch even when an incomplete sibling is drawn
 * first, and treat SG edges as attachments rather than a disqualifying inbound.
 */
describe('simulate — backtracking traversal (QA-002)', () => {
  it('terminates on a cycle and blocks at the deepest dead end', () => {
    // alb → a → b → a (back edge). The visited-set must stop the loop, and the
    // deepest reached node is reported as the block.
    const sim = simulate(
      [N('alb1', 'alb'), N('a', 'ec2'), N('b', 'ec2')],
      [E('e1', 'alb1', 'a'), E('e2', 'a', 'b'), E('e3', 'b', 'a')],
    )
    expect(sim.ok).toBe(false)
    expect(sim.flows[0]!.blockedNodeId).toBe('b')
    expect(sim.flows[0]!.pathNodeIds).toEqual(['alb1', 'a', 'b'])
  })

  it('backtracks past a dead-end branch to a completed sibling (the QA-002 fix)', () => {
    // ALB → EC2-A is drawn FIRST but has no DB (dead end); ALB → EC2-B → RDS is a
    // complete path drawn second. The greedy tracer used to commit to EC2-A and
    // report failure; the backtracking tracer must find the EC2-B path.
    const sim = simulate(
      [N('alb1', 'alb'), N('ec2a', 'ec2'), N('ec2b', 'ec2'), N('rds1', 'rds')],
      [
        E('dead', 'alb1', 'ec2a'),
        E('live', 'alb1', 'ec2b'),
        E('db', 'ec2b', 'rds1'),
      ],
    )
    expect(sim.ok).toBe(true)
    expect(sim.flows[0]!.pathNodeIds).toEqual(['alb1', 'ec2b', 'rds1'])
    expect(sim.flows[0]!.pathEdgeIds).toEqual(['live', 'db'])
  })

  it('takes the first sink it reaches when the branch order already works', () => {
    // ALB → S3 (sink) drawn first short-circuits, EC2 branch is never needed.
    const viaS3 = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2'), N('s31', 's3'), N('rds1', 'rds')],
      [E('e1', 'alb1', 's31'), E('e2', 'alb1', 'ec21'), E('e3', 'ec21', 'rds1')],
    )
    expect(viaS3.ok).toBe(true)
    expect(viaS3.flows[0]!.pathNodeIds).toEqual(['alb1', 's31'])
  })

  it('fails only when every branch is a dead end', () => {
    // Two branches, neither reaches a sink → the flow is genuinely blocked.
    const sim = simulate(
      [N('alb1', 'alb'), N('ec2a', 'ec2'), N('ec2b', 'ec2')],
      [E('e1', 'alb1', 'ec2a'), E('e2', 'alb1', 'ec2b')],
    )
    expect(sim.ok).toBe(false)
    expect(sim.flows[0]!.blockedNodeId === 'ec2a' || sim.flows[0]!.blockedNodeId === 'ec2b').toBe(
      true,
    )
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

/**
 * Traffic-visualization metadata (ADR 0048/0049): the sim surfaces a load-balancer
 * fan-out map and per-edge ok/blocked status for the renderer.
 */
describe('simulate — traffic viz metadata', () => {
  it('slots every target edge of a reachable ALB for round-robin fan-out', () => {
    const sim = simulate(
      [N('alb1', 'alb'), N('ec2a', 'ec2'), N('ec2b', 'ec2'), N('rds1', 'rds')],
      [
        E('t1', 'alb1', 'ec2a'),
        E('t2', 'alb1', 'ec2b'),
        E('d1', 'ec2a', 'rds1'),
      ],
    )
    // Both ALB → EC2 edges are slotted, even the one off the traced success path.
    expect(sim.fanout['t1']).toEqual({ index: 0, total: 2 })
    expect(sim.fanout['t2']).toEqual({ index: 1, total: 2 })
  })

  it('does not fan out a single-target ALB', () => {
    const sim = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2'), N('rds1', 'rds')],
      [E('t1', 'alb1', 'ec21'), E('t2', 'ec21', 'rds1')],
    )
    expect(sim.fanout['t1']).toBeUndefined()
  })

  it('highlights every branch of an HA fan-out, not just one traced path', () => {
    // ALB → 2 EC2, and BOTH EC2 → RDS. The load balancer distributes to both
    // app servers, so both downstream branches to the DB must light up 'ok' —
    // not only the single path the per-flow DFS happens to pick.
    const sim = simulate(
      [N('alb1', 'alb'), N('ec2a', 'ec2'), N('ec2b', 'ec2'), N('rds1', 'rds')],
      [
        E('la', 'alb1', 'ec2a'),
        E('lb', 'alb1', 'ec2b'),
        E('da', 'ec2a', 'rds1'),
        E('db', 'ec2b', 'rds1'),
      ],
    )
    expect(sim.edgeStatus['la']).toBe('ok')
    expect(sim.edgeStatus['lb']).toBe('ok')
    expect(sim.edgeStatus['da']).toBe('ok')
    expect(sim.edgeStatus['db']).toBe('ok')
    expect([...sim.pathNodeIds].sort()).toEqual(['alb1', 'ec2a', 'ec2b', 'rds1'])
    expect(sim.blockedNodeIds).toHaveLength(0)
  })

  it('marks a fan-out target that cannot reach a sink as a red dead end', () => {
    // ALB fans out to ec2a (→RDS, ok) and ec2b (no DB). The ec2b branch is
    // blocked and ec2b is a dead end, but the flow still clears via ec2a.
    const sim = simulate(
      [N('alb1', 'alb'), N('ec2a', 'ec2'), N('ec2b', 'ec2'), N('rds1', 'rds')],
      [E('la', 'alb1', 'ec2a'), E('lb', 'alb1', 'ec2b'), E('da', 'ec2a', 'rds1')],
    )
    expect(sim.ok).toBe(true)
    expect(sim.edgeStatus['la']).toBe('ok')
    expect(sim.edgeStatus['lb']).toBe('blocked')
    expect(sim.blockedNodeIds).toContain('ec2b')
  })

  it('marks edges ok on a successful flow and blocked on a failed one', () => {
    const ok = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2'), N('rds1', 'rds')],
      [E('e1', 'alb1', 'ec21'), E('e2', 'ec21', 'rds1')],
    )
    expect(ok.edgeStatus['e1']).toBe('ok')
    expect(ok.edgeStatus['e2']).toBe('ok')

    const blocked = simulate(
      [N('alb1', 'alb'), N('ec21', 'ec2')],
      [E('e1', 'alb1', 'ec21')],
    )
    expect(blocked.edgeStatus['e1']).toBe('blocked')
  })
})
