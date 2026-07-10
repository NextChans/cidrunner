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
    const { nodes, edges, securityGroups } = bestPracticeTopology()
    const design = designFromHash(packHash(toSnapshot(nodes, edges, null, securityGroups)))
    expect(design).not.toBeNull()
    expect(design!.nodes).toHaveLength(nodes.length)
    expect(design!.edges).toHaveLength(edges.length)
    expect(design!.nodes.find((n) => n.id === 'subnet-1')?.parentId).toBe('vpc-1')
    expect(design!.nodes.find((n) => n.id === 'rds-10')?.data.config.engine).toBe('mysql')
    // Security groups (ADR 0059) round-trip as a collection + assignment.
    expect(design!.securityGroups).toHaveLength(1)
    expect(design!.securityGroups[0]!.id).toBe('sg-7')
    expect(design!.nodes.find((n) => n.id === 'rds-10')?.data.config.securityGroupIds).toEqual([
      'sg-7',
    ])
  })

  it('migrates a legacy v1 design (sg nodes + attachment edges) to the collection', () => {
    // Immutable #g= URLs shared before ADR 0059 must keep loading: legacy sg
    // nodes become defs and their attachment edges become assignments.
    const legacy = {
      v: 1 as const,
      nodes: [
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('sg-1', 'sg', 'vpc-1', { allow_http: true, allow_https: true, allow_ssh: true }, 'Web SG'),
        N('ec2-1', 'ec2', 'vpc-1', { instance_type: 't3.micro', ami: 'auto' }),
      ],
      edges: [E('a1', 'sg-1', 'ec2-1')],
    }
    const design = sanitizeSnapshot(legacy)
    expect(design).not.toBeNull()
    // sg node dropped from the canvas graph, folded into the collection.
    expect(design!.nodes.some((n) => n.data.type === 'sg')).toBe(false)
    expect(design!.securityGroups).toHaveLength(1)
    expect(design!.securityGroups[0]).toMatchObject({ id: 'sg-1', name: 'Web SG', allowSsh: true })
    // Attachment edge → assignment; the sg edge is not kept as a traffic edge.
    expect(design!.nodes.find((n) => n.id === 'ec2-1')?.data.config.securityGroupIds).toEqual([
      'sg-1',
    ])
    expect(design!.edges.some((e) => e.source === 'sg-1' || e.target === 'sg-1')).toBe(false)
  })

  it('restores a resized container to its resized size, not its created size', () => {
    // A NodeResizer resize writes the new size to top-level width/height (and
    // `measured`), leaving the original `style` stale. sanitizeSnapshot must
    // keep the resized size so children are not clamped into a shrunken box.
    const vpc = {
      id: 'vpc-1',
      type: 'resource',
      position: { x: 0, y: 0 },
      style: { width: 480, height: 340 }, // original created size (stale)
      width: 900, // resized (top-level, what RF writes)
      height: 700,
      measured: { width: 900, height: 700 },
      data: { type: 'vpc', label: 'VPC', config: { cidr_block: '10.0.0.0/16' } },
    }
    const clean = sanitizeSnapshot({ v: 1, nodes: [vpc], edges: [] })
    expect(clean).not.toBeNull()
    expect(clean!.nodes[0]!.style).toEqual({ width: 900, height: 700 })
  })

  it('falls back to the style size for a container that was never resized', () => {
    const vpc = {
      id: 'vpc-1',
      type: 'resource',
      position: { x: 0, y: 0 },
      style: { width: 480, height: 340 },
      data: { type: 'vpc', label: 'VPC', config: { cidr_block: '10.0.0.0/16' } },
    }
    const clean = sanitizeSnapshot({ v: 1, nodes: [vpc], edges: [] })
    expect(clean!.nodes[0]!.style).toEqual({ width: 480, height: 340 })
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
