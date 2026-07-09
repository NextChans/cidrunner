import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import { getMission, missions } from '@/missions'
import { getResource } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { MissionCheckContext } from '@/missions/types'
import { N } from './helpers'

/** Builds a live mission-check context exactly as the MissionPanel does. */
function ctxFor(nodes: ResourceNodeType[], edges: Edge[] = []): MissionCheckContext {
  const issues = graphIssues(nodes, edges)
  const allValid = nodes.every(
    (n) =>
      (getResource(n.data.type).validate?.(n.data.config) ?? []).length === 0 &&
      (issues.errors.get(n.id)?.length ?? 0) === 0,
  )
  const securityOk = nodes.every((n) => (issues.warnings.get(n.id)?.length ?? 0) === 0)
  return { nodes, edges, sim: simulate(nodes, edges), allValid, securityOk, issues }
}

/** Indices of the tutorial steps that report done for a given graph. */
function doneSteps(nodes: ResourceNodeType[]): number[] {
  const steps = getMission('tutorial')!.steps!
  const ctx = ctxFor(nodes)
  return steps.flatMap((s, i) => (s.done(ctx) ? [i] : []))
}

describe('tutorial interactive steps (ADR 0030)', () => {
  it('steps ship only where intended (tutorial + ops tier); others stay step-less', () => {
    const withSteps = missions.filter((m) => m.steps)
    expect(withSteps.map((m) => m.id)).toEqual(['tutorial', 'ha-survival', 'lean-serverless'])
    expect(getMission('tutorial')!.steps).toHaveLength(4)
  })

  it('leaves the build steps open on the empty canvas', () => {
    // Step 2 ("no invalid nodes") is vacuously true with zero nodes — same as
    // the ★2 star rule — but the VPC/subnet/IGW steps stay open, so the
    // highlighted "next" step is still step 0 (place a VPC).
    const done = doneSteps([])
    expect(done).not.toContain(0)
    expect(done).not.toContain(1)
    expect(done).not.toContain(3)
    const nextIndex = getMission('tutorial')!.steps!.findIndex((_step, i) => !done.includes(i))
    expect(nextIndex).toBe(0)
  })

  it('ticks step 1 once a VPC exists', () => {
    const nodes = [N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })]
    expect(doneSteps(nodes)).toEqual([0, 2]) // VPC placed; graph has no invalid nodes yet
  })

  it('ticks the public-subnet step when a public subnet nests in the VPC', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    ]
    expect(doneSteps(nodes)).toContain(1)
  })

  it('completes every step — and clears three stars — with the IGW added', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('igw-2', 'igw', 'vpc-1', {}),
    ]
    expect(doneSteps(nodes)).toEqual([0, 1, 2, 3])
    expect(getMission('tutorial')!.check!(ctxFor(nodes))).toBe(3)
  })

  it('leaves the IGW step open until the internet gateway is attached', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    ]
    expect(doneSteps(nodes)).not.toContain(3)
    expect(getMission('tutorial')!.check!(ctxFor(nodes))).toBe(2)
  })
})
