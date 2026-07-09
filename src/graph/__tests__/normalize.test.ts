import { describe, expect, it } from 'vitest'
import { normalizeContainment } from '@/graph/containment'
import type { ResourceType } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'

/** Node with explicit position (+ optional size / parent) for geometry tests. */
function G(
  id: string,
  type: ResourceType,
  position: { x: number; y: number },
  opts: { size?: { width: number; height: number }; parentId?: string } = {},
): ResourceNodeType {
  const node: ResourceNodeType = {
    id,
    type: 'resource',
    position,
    data: { type, label: id, config: {} },
  }
  if (opts.size) node.style = opts.size
  if (opts.parentId) {
    node.parentId = opts.parentId
    node.extent = 'parent'
  }
  return node
}

const byId = (nodes: ResourceNodeType[]) => new Map(nodes.map((n) => [n.id, n]))

describe('normalizeContainment (ADR 0040)', () => {
  it('adopts a free node spatially inside a container it may nest under', () => {
    const nodes = [
      G('vpc-1', 'vpc', { x: 0, y: 0 }, { size: { width: 500, height: 400 } }),
      G('subnet-1', 'subnet', { x: 50, y: 50 }, { size: { width: 300, height: 200 }, parentId: 'vpc-1' }),
      G('ec2-1', 'ec2', { x: 100, y: 100 }), // free, but sits inside subnet-1 abs bbox
    ]
    const out = normalizeContainment(nodes)
    const ec2 = byId(out).get('ec2-1')!
    expect(ec2.parentId).toBe('subnet-1')
    expect(ec2.extent).toBe('parent')
    // ec2 abs (100,100) − subnet abs (50,50) = (50,50)
    expect(ec2.position).toEqual({ x: 50, y: 50 })
  })

  it('picks the innermost container and normalizes nesting depth in one pass', () => {
    const nodes = [
      G('vpc-1', 'vpc', { x: 0, y: 0 }, { size: { width: 500, height: 400 } }),
      G('subnet-1', 'subnet', { x: 50, y: 50 }, { size: { width: 300, height: 200 } }), // free
      G('ec2-1', 'ec2', { x: 100, y: 100 }), // free, inside subnet (∴ inside vpc)
    ]
    const out = normalizeContainment(nodes)
    const m = byId(out)
    expect(m.get('subnet-1')!.parentId).toBe('vpc-1')
    expect(m.get('ec2-1')!.parentId).toBe('subnet-1') // innermost, not the vpc
    // Composed absolute position is preserved: vpc(0,0)+subnet(50,50)+ec2(50,50) = (100,100)
    expect(m.get('ec2-1')!.position).toEqual({ x: 50, y: 50 })
    // Parent precedes child in the array.
    const ids = out.map((n) => n.id)
    expect(ids.indexOf('vpc-1')).toBeLessThan(ids.indexOf('subnet-1'))
    expect(ids.indexOf('subnet-1')).toBeLessThan(ids.indexOf('ec2-1'))
  })

  it('leaves already-parented nodes untouched ("없는 것만 채움")', () => {
    const nodes = [
      G('vpc-1', 'vpc', { x: 0, y: 0 }, { size: { width: 500, height: 400 } }),
      G('subnet-1', 'subnet', { x: 50, y: 50 }, { size: { width: 300, height: 200 }, parentId: 'vpc-1' }),
      // Parented to vpc-1 but positioned oddly; must keep its parent regardless.
      G('nat-1', 'nat', { x: 10, y: 10 }, { parentId: 'subnet-1' }),
    ]
    const out = normalizeContainment(nodes)
    expect(out).toBe(nodes) // no change → same reference
    expect(byId(out).get('nat-1')!.parentId).toBe('subnet-1')
  })

  it('does not adopt a node the rules forbid, even if geometrically inside', () => {
    const nodes = [
      G('vpc-1', 'vpc', { x: 0, y: 0 }, { size: { width: 500, height: 400 } }),
      G('subnet-1', 'subnet', { x: 50, y: 50 }, { size: { width: 300, height: 200 }, parentId: 'vpc-1' }),
      // S3 may only live at the canvas root; sitting inside a subnet must not nest it.
      G('s3-1', 's3', { x: 100, y: 100 }),
    ]
    const out = normalizeContainment(nodes)
    expect(byId(out).get('s3-1')!.parentId).toBeUndefined()
  })

  it('leaves a free node outside every container alone', () => {
    const nodes = [
      G('vpc-1', 'vpc', { x: 0, y: 0 }, { size: { width: 200, height: 200 } }),
      G('ec2-1', 'ec2', { x: 400, y: 400 }), // well outside the vpc
    ]
    const out = normalizeContainment(nodes)
    expect(out).toBe(nodes)
    expect(byId(out).get('ec2-1')!.parentId).toBeUndefined()
  })
})
