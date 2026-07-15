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

  it('skips unsupported resource types instead of failing the whole import', () => {
    // A real exported topology may reference resources cidrunner does not model
    // (e.g. ECR, CloudTrail). Load what we can; report what we dropped.
    const design = sanitizeSnapshot({
      v: 2,
      nodes: [
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('ecr-1', 'ecr' as never, undefined, { scan_on_push: true }),
        N('ec2-1', 'ec2', 'vpc-1', { instance_type: 't3.micro', ami: 'auto' }),
      ],
      edges: [E('e1', 'ecr-1', 'ec2-1'), E('e2', 'ec2-1', 'ec2-1')],
    })
    expect(design).not.toBeNull()
    expect(design!.nodes.map((n) => n.id).sort()).toEqual(['ec2-1', 'vpc-1'])
    expect(design!.unsupportedTypes).toEqual(['ecr'])
    // The edge to the dropped ECR node is gone; the self-edge survives.
    expect(design!.edges.some((e) => e.source === 'ecr-1')).toBe(false)
  })

  it('cascades: a child of an unsupported container is dropped too', () => {
    const design = sanitizeSnapshot({
      v: 2,
      nodes: [
        N('mesh-1', 'appmesh' as never, undefined, {}),
        N('ec2-1', 'ec2', 'mesh-1', { instance_type: 't3.micro', ami: 'auto' }),
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      ],
      edges: [],
    })
    expect(design).not.toBeNull()
    expect(design!.nodes.map((n) => n.id)).toEqual(['vpc-1'])
    expect(design!.unsupportedTypes).toEqual(['appmesh'])
  })

  it('rejects structurally broken shapes', () => {
    // Structural corruption still fails hard; unknown *resource types* no longer
    // do (they're skipped — see the resilient-import test above).
    expect(designFromHash('#g=%%%%')).toBeNull()
    expect(designFromHash('#other')).toBeNull()
    expect(sanitizeSnapshot({ nodes: 'nope', edges: [] })).toBeNull()
    expect(sanitizeSnapshot('not an object')).toBeNull()
    // An unknown type is skipped, not fatal: this loads to an empty design.
    const unknown = sanitizeSnapshot({
      nodes: [{ id: 'x', data: { type: 'not-a-type' }, position: { x: 0, y: 0 } }],
      edges: [],
    })
    expect(unknown).not.toBeNull()
    expect(unknown!.nodes).toEqual([])
    expect(unknown!.unsupportedTypes).toEqual(['not-a-type'])
  })

  it('drops dangling references (parent/edge to missing nodes) instead of failing', () => {
    // A node whose parent never existed is cascade-dropped, not a hard reject.
    const orphan = { ...N('ec2-1', 'ec2', 'subnet-9'), extent: 'parent' as const }
    const dropped = sanitizeSnapshot({ v: 1, nodes: [orphan], edges: [] })
    expect(dropped).not.toBeNull()
    expect(dropped!.nodes).toEqual([])
    // An edge to a missing node is skipped; the valid node still loads.
    const edgeToGhost = sanitizeSnapshot({
      v: 1,
      nodes: [N('s3-1', 's3')],
      edges: [E('e1', 's3-1', 'ghost')],
    })
    expect(edgeToGhost).not.toBeNull()
    expect(edgeToGhost!.nodes.map((n) => n.id)).toEqual(['s3-1'])
    expect(edgeToGhost!.edges).toEqual([])
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
