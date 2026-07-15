import { describe, expect, it } from 'vitest'
import { generateDrawio } from '@/graph/drawio'
import { N, E } from './helpers'

describe('generateDrawio (ADR 0064)', () => {
  it('emits a well-formed mxfile with one cell per node + edge', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }, 'Prod VPC'),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }, 'Public A'),
      N('ec2-1', 'ec2', 'subnet-1', { instance_type: 't3.micro', ami: 'auto', securityGroupIds: ['sg-1'] }, 'App'),
    ]
    const edges = [E('t1', 'ec2-1', 'ec2-1')]
    const xml = generateDrawio(nodes, edges, [
      { id: 'sg-1', name: 'web-sg', allowHttp: true, allowHttps: true, allowSsh: false },
    ])

    expect(xml.startsWith('<mxfile')).toBe(true)
    expect(xml).toContain('<mxGraphModel')
    expect(xml).toContain('<mxCell id="0" />')
    expect(xml).toContain('<mxCell id="1" parent="0" />')
    // A cell per node, keyed by prefixed id.
    expect(xml).toContain('id="n-vpc-1"')
    expect(xml).toContain('id="n-subnet-1"')
    expect(xml).toContain('id="n-ec2-1"')
    // AWS4 shapes: container group + resource icon.
    expect(xml).toContain('mxgraph.aws4.group_vpc')
    expect(xml).toContain('resIcon=mxgraph.aws4.ec2')
    // Containment: child references its parent cell.
    expect(xml).toContain('parent="n-vpc-1"')
    expect(xml).toContain('parent="n-subnet-1"')
    // Edge with prefixed source/target.
    expect(xml).toContain('source="n-ec2-1" target="n-ec2-1"')
    // Assigned SG surfaced in the label (SGs aren't nodes — ADR 0059).
    expect(xml).toContain('web-sg')
    // Tags balance — a cheap structural sanity check.
    expect((xml.match(/<mxCell /g) ?? []).length).toBe((xml.match(/<\/mxCell>/g) ?? []).length + 2)
  })

  it('XML-escapes labels and drops edges to missing nodes', () => {
    const nodes = [N('s3-1', 's3', undefined, {}, 'A & B <tag> "q"')]
    const xml = generateDrawio(nodes, [E('e1', 's3-1', 'ghost')])
    expect(xml).toContain('A &amp; B &lt;tag&gt; &quot;q&quot;')
    expect(xml).not.toContain('id="e-e1"')
  })

  it('uses the verified short AWS4 resIcon tokens (not the long service names)', () => {
    // Regression: ecs/ecr/s3/eks/sqs/sns render as blank blocks under the long
    // names — the drawio aws4 library uses short tokens for these families.
    const nodes = [
      N('ecs-1', 'ecs', undefined, {}),
      N('ecr-1', 'ecr', undefined, {}),
      N('s3-1', 's3', undefined, {}),
      N('eks-1', 'eks', undefined, {}),
      N('sqs-1', 'sqs', undefined, {}),
      N('sns-1', 'sns', undefined, {}),
    ]
    const xml = generateDrawio(nodes)
    for (const tok of ['ecs', 'ecr', 's3', 'eks', 'sqs', 'sns']) {
      expect(xml).toContain(`resIcon=mxgraph.aws4.${tok};`)
    }
    expect(xml).not.toContain('elastic_container_service')
    expect(xml).not.toContain('simple_storage_service')
    // Canonical resourceIcon template renders the glyph white.
    expect(xml).toContain('strokeColor=#ffffff')
  })

  it('maps Kinesis to its resource icon (regression: was unmapped → blank box)', () => {
    const xml = generateDrawio([N('k-1', 'kinesis', undefined, {})])
    expect(xml).toContain('resIcon=mxgraph.aws4.kinesis;')
  })

  it('folds parent-less global services into the account box (차니 요청)', () => {
    // Regional/global services sit at the canvas top level; export should reparent
    // them into the account so it visually encloses everything.
    const nodes = [
      N('account-1', 'account', undefined, {}),
      N('vpc-1', 'vpc', 'account-1', { cidr_block: '10.0.0.0/16' }),
      N('waf-1', 'waf', undefined, {}),
      N('s3-1', 's3', undefined, {}),
    ]
    // account needs an authored size to base the reflow on.
    nodes[0]!.style = { width: 1600, height: 1200 }
    const xml = generateDrawio(nodes)
    // Globals reparented under the account, not left at the root layer ("1").
    expect(xml).toMatch(/id="n-waf-1"[^>]*parent="n-account-1"/)
    expect(xml).toMatch(/id="n-s3-1"[^>]*parent="n-account-1"/)
    // The account grew past its authored height to make room for the strip.
    expect(xml).toMatch(/id="n-account-1"[\s\S]*?height="1[3-9]\d\d"/)
  })

  it('uses public vs private subnet group icons from config', () => {
    const nodes = [
      N('v', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('pub', 'subnet', 'v', { cidr_block: '10.0.1.0/24', public: true }),
      N('priv', 'subnet', 'v', { cidr_block: '10.0.2.0/24', public: false }),
    ]
    const xml = generateDrawio(nodes)
    expect(xml).toContain('group_public_subnet')
    expect(xml).toContain('group_private_subnet')
  })
})
