import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import { wellArchitectedGrade } from '@/graph/grade'
import { getMission } from '@/missions'
import type { MissionCheckContext } from '@/missions/types'
import type { SecurityGroupDef } from '@/graph/securityGroups'
import type { ResourceNodeType } from '@/store/useGraphStore'
import { N, E, bestPracticeTopology } from '@/graph/__tests__/helpers'

const ctxFor = (
  nodes: ResourceNodeType[],
  edges: Edge[],
  securityGroups: SecurityGroupDef[] = [],
): MissionCheckContext => {
  const issues = graphIssues(nodes, edges, securityGroups)
  const allValid = nodes.every((n) => (issues.errors.get(n.id)?.length ?? 0) === 0)
  const securityOk = nodes.every((n) => (issues.warnings.get(n.id)?.length ?? 0) === 0)
  return { nodes, edges, securityGroups, sim: simulate(nodes, edges), allValid, securityOk, issues }
}

const mission = getMission('well-architected-review')!
const LETTER_STARS: Record<string, number> = { S: 3, A: 2, B: 1, C: 0, D: 0 }

describe('Well-Architected review mission (ADR 0067)', () => {
  it('does not clear an empty or broken design', () => {
    expect(mission.check!(ctxFor([], []))).toBe(0)
    // A lone, unreachable EC2: sim fails → 0 regardless of grade.
    expect(mission.check!(ctxFor([N('ec2-1', 'ec2', undefined, {})], []))).toBe(0)
  })

  it('mirrors the live grade badge: B→1, A→2, S→3', () => {
    const { nodes, edges, securityGroups } = bestPracticeTopology()
    const grade = wellArchitectedGrade(nodes, edges, securityGroups)
    // A solid 2-AZ / Multi-AZ 3-tier grades A (no CDN/cache, one AZ has the
    // only app server so it doesn't survive every fault) — a fair ★2.
    expect(grade.letter).toBe('A')
    expect(mission.check!(ctxFor(nodes, edges, securityGroups))).toBe(LETTER_STARS[grade.letter])
  })

  it('awards ★3 for a fully-rounded S-grade design', () => {
    const sg = { securityGroupIds: ['sg-1'] }
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('pub-a', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('pub-b', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
      N('prv-a', 'subnet', 'vpc-1', { cidr_block: '10.0.11.0/24', az: 'a', public: false }),
      N('prv-b', 'subnet', 'vpc-1', { cidr_block: '10.0.12.0/24', az: 'b', public: false }),
      N('igw-1', 'igw', 'vpc-1', {}),
      N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...sg }),
      // App server in EACH AZ so the chain survives either single-AZ failure.
      N('ec2-a', 'ec2', 'prv-a', { instance_type: 't3.micro', ami: 'auto', ...sg }),
      N('ec2-b', 'ec2', 'prv-b', { instance_type: 't3.micro', ami: 'auto', ...sg }),
      N('rds-1', 'rds', 'prv-b', {
        engine: 'mysql',
        instance_class: 'db.t3.micro',
        allocated_storage: 20,
        multi_az: true,
        storage_encrypted: true,
        ...sg,
      }),
      // Accelerators for the performance pillar.
      N('cf-1', 'cloudfront', undefined, {}),
      N('cache-1', 'elasticache', 'prv-a', { engine: 'redis', node_type: 'cache.t3.micro', ...sg }),
    ]
    const edges = [
      E('e1', 'cf-1', 'alb-1'),
      E('e2', 'alb-1', 'ec2-a'),
      E('e3', 'alb-1', 'ec2-b'),
      E('e4', 'ec2-a', 'rds-1'),
      E('e5', 'ec2-b', 'rds-1'),
      E('e6', 'ec2-a', 'cache-1'),
      E('e7', 'ec2-b', 'cache-1'),
    ]
    const securityGroups = [
      { id: 'sg-1', name: 'app', allowHttp: true, allowHttps: true, allowSsh: false },
    ]
    const grade = wellArchitectedGrade(nodes, edges, securityGroups)
    expect(grade.letter).toBe('S')
    expect(mission.check!(ctxFor(nodes, edges, securityGroups))).toBe(3)
  })
})
