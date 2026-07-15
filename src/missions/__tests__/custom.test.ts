import { describe, expect, it } from 'vitest'
import {
  sanitizeCustomMission,
  toMission,
  customMissionFromHash,
  CUSTOM_MISSION_ID,
  type CustomMissionSpec,
} from '@/missions/custom'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import type { MissionCheckContext } from '@/missions/types'
import { N, E } from '@/graph/__tests__/helpers'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { Edge } from '@xyflow/react'

const ctxFor = (nodes: ResourceNodeType[], edges: Edge[]): MissionCheckContext => {
  const issues = graphIssues(nodes, edges)
  const allValid = nodes.every((n) => (issues.errors.get(n.id)?.length ?? 0) === 0)
  const securityOk = nodes.every((n) => (issues.warnings.get(n.id)?.length ?? 0) === 0)
  return { nodes, edges, securityGroups: [], sim: simulate(nodes, edges), allValid, securityOk, issues }
}

describe('custom missions (ADR 0065)', () => {
  it('round-trips a spec through the #m= URL codec', () => {
    const spec: CustomMissionSpec = {
      title: '3-tier',
      goal: 'ALB → EC2 → RDS',
      hint: 'SG 지정',
      chain: [['alb'], ['ec2', 'ecs'], ['rds']],
      budget: 60,
    }
    // encodeCustomMissionUrl needs window.location (absent in the node env), so
    // exercise the parser against a fragment packed by the same base64url codec.
    const packed = encodeFragment(spec)
    const parsed = customMissionFromHash(`#m=${packed}`)
    expect(parsed).toEqual(spec)
  })

  it('rejects malformed specs (whitelist)', () => {
    expect(sanitizeCustomMission(null)).toBeNull()
    expect(sanitizeCustomMission({ title: 'x' })).toBeNull() // no goal
    expect(sanitizeCustomMission({ title: 'x', goal: 'y', chain: [] })).toBeNull() // empty chain
    expect(sanitizeCustomMission({ title: 'x', goal: 'y', chain: [[]] })).toBeNull() // empty step
    expect(
      sanitizeCustomMission({ title: 'x', goal: 'y', chain: [['not-a-type']] }),
    ).toBeNull() // step with no known type
    // Unknown types inside a step are filtered but the step survives if ≥1 known.
    const ok = sanitizeCustomMission({ title: 'x', goal: 'y', chain: [['ec2', 'bogus']] })
    expect(ok?.chain).toEqual([['ec2']])
  })

  it('grades with the generic 0–3★ rubric', () => {
    const spec: CustomMissionSpec = { title: 't', goal: 'g', chain: [['alb'], ['ec2'], ['rds']] }
    const mission = toMission(spec)
    expect(mission.id).toBe(CUSTOM_MISSION_ID)

    // A clean 2-AZ 3-tier build: chain flows, no errors, SG assigned → 3★.
    const sg = { securityGroupIds: ['sg-1'] }
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
      N('s3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
      N('s4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }),
      N('igw-1', 'igw', 'vpc-1', {}),
      N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...sg }),
      N('ec2-1', 'ec2', 's3', { instance_type: 't3.micro', ami: 'auto', ...sg }),
      N('rds-1', 'rds', 's4', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, multi_az: true, storage_encrypted: true, ...sg }),
    ]
    const edges = [E('t1', 'alb-1', 'ec2-1'), E('t2', 'ec2-1', 'rds-1')]
    const issues = graphIssues(nodes, edges, [
      { id: 'sg-1', name: 'web', allowHttp: true, allowHttps: true, allowSsh: false },
    ])
    const allValid = nodes.every((n) => (issues.errors.get(n.id)?.length ?? 0) === 0)
    const ctx: MissionCheckContext = {
      nodes,
      edges,
      securityGroups: [{ id: 'sg-1', name: 'web', allowHttp: true, allowHttps: true, allowSsh: false }],
      sim: simulate(nodes, edges),
      allValid,
      securityOk: true,
      issues,
    }
    expect(mission.check!(ctx)).toBe(3)

    // No chain → 0★.
    expect(mission.check!(ctxFor([N('s3-x', 's3', undefined, {})], []))).toBe(0)
  })
})

// Mirror of the codec so the round-trip test doesn't depend on window.location.
function encodeFragment(spec: CustomMissionSpec): string {
  const json = JSON.stringify(spec)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
