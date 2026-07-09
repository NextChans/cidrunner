import { describe, expect, it } from 'vitest'
import { graphIssues } from '@/graph/checks'
import { useGraphStore } from '@/store/useGraphStore'
import { bestPracticeTopology, N } from './helpers'

/**
 * Containment-legality rule (ADR 0045 / QA-001). Containment used to be enforced
 * only when a node was created; detach, shared-URL/gallery-slot load, and
 * hand-edited JSON could leave a resource that requires a container orphaned at
 * the canvas root. This suite pins the always-on validation: a resource whose
 * `allowedParents` excludes 'canvas' is an *error* when it has no parent, while
 * global services (allowedParents includes 'canvas') stay legal at the root.
 */

/** All error messages for `id`, joined — undefined-safe. */
const errs = (id: string, nodes: Parameters<typeof graphIssues>[0]) =>
  (graphIssues(nodes, []).errors.get(id) ?? []).join(' | ')

const ORPHAN = '배치되어야'

describe('containment legality (ADR 0045 / QA-001)', () => {
  it('errors on an EC2 orphaned at the canvas root', () => {
    const nodes = [N('ec2-1', 'ec2', undefined, { instance_type: 't3.micro', ami: 'auto' })]
    expect(errs('ec2-1', nodes)).toContain(ORPHAN)
    expect(errs('ec2-1', nodes)).toContain('Subnet')
  })

  it('passes an EC2 nested in a subnet', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('ec2-1', 'ec2', 's1', { instance_type: 't3.micro', ami: 'auto' }),
    ]
    expect(errs('ec2-1', nodes)).not.toContain(ORPHAN)
  })

  it('errors on an internet-facing ALB orphaned at the root', () => {
    const nodes = [N('alb-1', 'alb', undefined, { internal: false, listener_port: 80 })]
    expect(errs('alb-1', nodes)).toContain(ORPHAN)
    expect(errs('alb-1', nodes)).toContain('VPC')
  })

  it('passes an ALB nested in a VPC (no containment error)', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80 }),
    ]
    expect(errs('alb-1', nodes)).not.toContain(ORPHAN)
  })

  it('errors on a subnet at the root (needs a VPC)', () => {
    const nodes = [N('s1', 'subnet', undefined, { cidr_block: '10.0.1.0/24', az: 'a' })]
    expect(errs('s1', nodes)).toContain(ORPHAN)
    expect(errs('s1', nodes)).toContain('VPC')
  })

  it('passes a subnet nested in a VPC', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a' }),
    ]
    expect(errs('s1', nodes)).not.toContain(ORPHAN)
  })

  it('errors on a NAT gateway orphaned at the root', () => {
    const nodes = [N('nat-1', 'nat', undefined)]
    expect(errs('nat-1', nodes)).toContain(ORPHAN)
  })

  it('treats a dangling parentId (parent node missing) as orphaned', () => {
    // Hand-edited JSON / partial load can reference a parent that no longer
    // exists — the node is effectively at the root and must be flagged.
    const nodes = [N('ec2-1', 'ec2', 'ghost-subnet', { instance_type: 't3.micro', ami: 'auto' })]
    expect(errs('ec2-1', nodes)).toContain(ORPHAN)
  })

  it('leaves global services (S3) legal at the root', () => {
    const nodes = [N('s3-1', 's3', undefined, { encryption: true, block_public_access: true })]
    expect(errs('s3-1', nodes)).toBe('')
  })

  it('leaves Cognito / Kinesis / Route53 legal at the root', () => {
    for (const type of ['cognito', 'kinesis', 'route53'] as const) {
      const nodes = [N(`${type}-1`, type, undefined)]
      expect(errs(`${type}-1`, nodes)).not.toContain(ORPHAN)
    }
  })

  it('leaves a VPC legal at the root', () => {
    const nodes = [N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })]
    expect(errs('vpc-1', nodes)).not.toContain(ORPHAN)
  })

  it('does not regress the best-practice topology (zero errors)', () => {
    const { nodes, edges } = bestPracticeTopology()
    expect(graphIssues(nodes, edges).errors.size).toBe(0)
  })

  it('flags a node after it is detached from its parent (F1 detachNode)', () => {
    // The exact escape hatch QA-001 called out: containment is fine on create,
    // then detach strips the parent link and nothing re-validates.
    useGraphStore.setState({
      nodes: [
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
        N('ec2-1', 'ec2', 's1', { instance_type: 't3.micro', ami: 'auto' }),
      ],
      edges: [],
      selectedNodeId: null,
      contextMenu: null,
    })
    const before = useGraphStore.getState().nodes
    expect(errs('ec2-1', before)).not.toContain(ORPHAN)

    useGraphStore.getState().detachNode('ec2-1')
    const after = useGraphStore.getState().nodes
    expect(after.find((n) => n.id === 'ec2-1')?.parentId).toBeUndefined()
    expect(errs('ec2-1', after)).toContain(ORPHAN)
  })
})
