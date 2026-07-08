import { describe, expect, it } from 'vitest'
import { designFromHash, sanitizeSnapshot, toSnapshot } from '@/graph/share'
import { bestPracticeTopology, E, N } from './helpers'

// Node's util TextEncoder/atob exist in the vitest node env too; the hash
// round-trip only needs btoa/atob + TextEncoder, all available.

function packHash(snapshot: unknown): string {
  const json = JSON.stringify(snapshot)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return '#g=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('share', () => {
  it('round-trips a design through the URL hash', () => {
    const { nodes, edges } = bestPracticeTopology()
    const design = designFromHash(packHash(toSnapshot(nodes, edges)))
    expect(design).not.toBeNull()
    expect(design!.nodes).toHaveLength(nodes.length)
    expect(design!.edges).toHaveLength(edges.length)
    expect(design!.nodes.find((n) => n.id === 'subnet-1')?.parentId).toBe('vpc-1')
    expect(design!.nodes.find((n) => n.id === 'rds-10')?.data.config.engine).toBe('mysql')
  })

  it('carries mission context and drops unknown mission ids', () => {
    const { nodes, edges } = bestPracticeTopology()
    const withMission = designFromHash(packHash(toSnapshot(nodes, edges, 'three-tier')))
    expect(withMission?.missionId).toBe('three-tier')

    const unknown = designFromHash(packHash({ ...toSnapshot(nodes, edges), m: 'not-a-mission' }))
    expect(unknown).not.toBeNull()
    expect(unknown?.missionId).toBeUndefined()

    const none = designFromHash(packHash(toSnapshot(nodes, edges)))
    expect(none?.missionId).toBeUndefined()
  })

  it('rejects garbage and foreign shapes', () => {
    expect(designFromHash('#g=%%%%')).toBeNull()
    expect(designFromHash('#other')).toBeNull()
    expect(sanitizeSnapshot({ nodes: 'nope', edges: [] })).toBeNull()
    expect(sanitizeSnapshot({ nodes: [{ id: 'x', data: { type: 'not-a-type' }, position: { x: 0, y: 0 } }], edges: [] })).toBeNull()
  })

  it('rejects dangling references (parent/edge to missing nodes)', () => {
    const orphan = { ...N('ec2-1', 'ec2', 'subnet-9'), extent: 'parent' as const }
    expect(sanitizeSnapshot({ v: 1, nodes: [orphan], edges: [] })).toBeNull()
    expect(
      sanitizeSnapshot({ v: 1, nodes: [N('s3-1', 's3')], edges: [E('e1', 's3-1', 'ghost')] }),
    ).toBeNull()
  })

  it('drops unknown fields instead of importing them', () => {
    const evil = {
      v: 1,
      nodes: [{ ...N('s3-1', 's3'), dragHandle: '.hijack', hidden: true }],
      edges: [],
    }
    const design = sanitizeSnapshot(evil)
    expect(design).not.toBeNull()
    const node = design!.nodes[0] as unknown as Record<string, unknown>
    expect(node.dragHandle).toBeUndefined()
    expect(node.hidden).toBeUndefined()
  })
})
