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
