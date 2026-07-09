import { describe, expect, it } from 'vitest'
import { derivedEdges, DERIVED_EDGE_PREFIX } from '@/graph/derived'
import { N } from './helpers'

describe('derived edges (ADR 0043)', () => {
  it('draws IGW → every public subnet in the same VPC, and nothing to private ones', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('pub-a', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('pub-b', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
      N('priv-a', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
      N('igw-2', 'igw', 'vpc-1', {}),
    ]
    const edges = derivedEdges(nodes)
    expect(edges).toHaveLength(2)
    expect(edges.map((e) => e.target).sort()).toEqual(['pub-a', 'pub-b'])
    for (const e of edges) {
      expect(e.source).toBe('igw-2')
      expect(e.type).toBe('derived')
      expect(e.selectable).toBe(false)
      expect(e.deletable).toBe(false)
      expect(e.id.startsWith(DERIVED_EDGE_PREFIX)).toBe(true)
    }
  })

  it('emits no derived edge when the VPC has an IGW but no public subnet', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('priv-a', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
      N('igw-2', 'igw', 'vpc-1', {}),
    ]
    expect(derivedEdges(nodes)).toHaveLength(0)
  })

  it('does not cross VPC boundaries', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('igw-1', 'igw', 'vpc-1', {}),
      N('pub-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('vpc-2', 'vpc', undefined, { cidr_block: '10.1.0.0/16' }),
      N('pub-2', 'subnet', 'vpc-2', { cidr_block: '10.1.1.0/24', az: 'a', public: true }),
    ]
    const edges = derivedEdges(nodes)
    // Only vpc-1's IGW routes, only to vpc-1's public subnet.
    expect(edges).toHaveLength(1)
    expect(edges[0]!.source).toBe('igw-1')
    expect(edges[0]!.target).toBe('pub-1')
  })

  it('emits nothing for an IGW that is not inside a VPC', () => {
    expect(derivedEdges([N('igw-loose', 'igw', undefined, {})])).toHaveLength(0)
  })
})
