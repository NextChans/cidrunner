import { describe, expect, it } from 'vitest'
import { soundPlan } from '@/audio/simSounds'
import { simulate, HOP_SECONDS } from '@/graph/simulate'
import { E, N } from '@/graph/__tests__/helpers'

describe('soundPlan (ADR 0058)', () => {
  it('schedules rising ticks per hop and one chime at the sink', () => {
    const nodes = [N('lam', 'lambda'), N('q', 'sqs'), N('w', 'lambda'), N('db', 'dynamodb')]
    const edges = [E('e1', 'lam', 'q'), E('e2', 'q', 'w'), E('e3', 'w', 'db')]
    const plan = soundPlan(simulate(nodes, edges))

    const ticks = plan.filter((e) => e.kind === 'tick')
    expect(ticks.map((t) => t.step)).toEqual([1, 2, 3])
    expect(ticks.map((t) => t.t)).toEqual([HOP_SECONDS, 2 * HOP_SECONDS, 3 * HOP_SECONDS])

    const chimes = plan.filter((e) => e.kind === 'chime')
    expect(chimes).toHaveLength(1)
    expect(chimes[0]!.t).toBeGreaterThan(3 * HOP_SECONDS)
    expect(plan.filter((e) => e.kind === 'buzz')).toHaveLength(0)
    // Time-ordered.
    expect([...plan].sort((a, b) => a.t - b.t)).toEqual(plan)
  })

  it('schedules a buzz for a blocked flow', () => {
    const plan = soundPlan(
      simulate([N('lam', 'lambda'), N('q', 'sqs')], [E('e1', 'lam', 'q')]),
    )
    expect(plan.filter((e) => e.kind === 'buzz')).toHaveLength(1)
    expect(plan.filter((e) => e.kind === 'chime')).toHaveLength(0)
  })

  it('dedupes shared hops across fan-out flows', () => {
    // Two flows (via two entries) that converge on the same sink node produce
    // ONE tick per (time, step), not one per flow.
    const nodes = [
      N('lam1', 'lambda'),
      N('lam2', 'lambda'),
      N('db', 'dynamodb'),
    ]
    const edges = [E('e1', 'lam1', 'db'), E('e2', 'lam2', 'db')]
    const plan = soundPlan(simulate(nodes, edges))
    const ticksAtFirstHop = plan.filter((e) => e.kind === 'tick' && e.step === 1)
    expect(ticksAtFirstHop).toHaveLength(1)
  })

  it('is silent for an empty simulation', () => {
    expect(soundPlan(simulate([], []))).toEqual([])
  })
})
