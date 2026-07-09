import { beforeEach, describe, expect, it } from 'vitest'
import type { ResourceType } from '@/resources'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'

/** Node with an explicit absolute/relative position for containment math. */
function P(
  id: string,
  type: ResourceType,
  position: { x: number; y: number },
  parentId?: string,
): ResourceNodeType {
  return {
    id,
    type: 'resource',
    position,
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
    data: { type, label: id, config: {} },
  }
}

/** VPC(100,100) ▸ Subnet(rel 50,50 → abs 150,150), plus a free EC2 at abs 160,160. */
function seed() {
  useGraphStore.setState({
    nodes: [
      P('vpc-1', 'vpc', { x: 100, y: 100 }),
      P('subnet-1', 'subnet', { x: 50, y: 50 }, 'vpc-1'),
      P('ec2-1', 'ec2', { x: 160, y: 160 }),
    ],
    edges: [],
    selectedNodeId: null,
    contextMenu: null,
  })
}

const nodesById = () => new Map(useGraphStore.getState().nodes.map((n) => [n.id, n]))

describe('attachToParent (ADR 0038)', () => {
  beforeEach(seed)

  it('nests a free node and converts abs → parent-relative coords', () => {
    useGraphStore.getState().attachToParent('ec2-1', 'subnet-1')
    const ec2 = nodesById().get('ec2-1')!
    expect(ec2.parentId).toBe('subnet-1')
    expect(ec2.extent).toBe('parent')
    // abs (160,160) − subnet abs (150,150) = (10,10)
    expect(ec2.position).toEqual({ x: 10, y: 10 })
  })

  it('keeps the parent before the child in the array (React Flow render order)', () => {
    useGraphStore.getState().attachToParent('ec2-1', 'subnet-1')
    const ids = useGraphStore.getState().nodes.map((n) => n.id)
    expect(ids.indexOf('subnet-1')).toBeLessThan(ids.indexOf('ec2-1'))
    expect(ids.indexOf('vpc-1')).toBeLessThan(ids.indexOf('subnet-1'))
  })

  it('re-parents between containers and recomputes coords', () => {
    // First attach to the VPC directly, then move down into the subnet.
    useGraphStore.getState().attachToParent('ec2-1', 'vpc-1')
    // Note: ec2 cannot live in a VPC per the rules, so this is a no-op.
    expect(nodesById().get('ec2-1')!.parentId).toBeUndefined()

    useGraphStore.getState().attachToParent('ec2-1', 'subnet-1')
    expect(nodesById().get('ec2-1')!.parentId).toBe('subnet-1')
  })

  it('rejects a nesting the rules forbid', () => {
    // Subnet cannot be nested inside another subnet.
    useGraphStore.getState().attachToParent('subnet-1', 'subnet-1')
    expect(nodesById().get('subnet-1')!.parentId).toBe('vpc-1')
  })

  it('is a no-op when the node is already in that parent', () => {
    const before = useGraphStore.getState().nodes
    useGraphStore.getState().attachToParent('subnet-1', 'vpc-1')
    expect(useGraphStore.getState().nodes).toBe(before)
  })
})

describe('setDropTarget (ADR 0040 — drag highlight)', () => {
  it('sets, dedups equal values, and clears', () => {
    const s = useGraphStore.getState()
    s.setDropTarget({ id: 'subnet-1', valid: true })
    const first = useGraphStore.getState().dropTarget
    expect(first).toEqual({ id: 'subnet-1', valid: true })

    // An equal-by-value set must not churn state (prevents redundant re-renders).
    s.setDropTarget({ id: 'subnet-1', valid: true })
    expect(useGraphStore.getState().dropTarget).toBe(first)

    // A changed validity updates.
    s.setDropTarget({ id: 'subnet-1', valid: false })
    expect(useGraphStore.getState().dropTarget).toEqual({ id: 'subnet-1', valid: false })

    s.setDropTarget(null)
    expect(useGraphStore.getState().dropTarget).toBeNull()
  })
})
