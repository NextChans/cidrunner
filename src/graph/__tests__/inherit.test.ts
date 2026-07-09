import { describe, expect, it } from 'vitest'
import { applyInheritedDefaults } from '@/graph/inherit'
import { N } from './helpers'

/**
 * Container-inherited defaults (ADR 0050): a node created inside a box picks up
 * sensible defaults from its container chain, applied once at creation.
 */
describe('inherit — container-derived defaults', () => {
  it('carves the first free /24 for a subnet in a VPC', () => {
    const vpc = N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })
    const sub = N('subnet-9', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false })
    applyInheritedDefaults(sub, [vpc])
    expect(sub.data.config.cidr_block).toBe('10.0.0.0/24')
  })

  it('skips /24 blocks already used by sibling subnets', () => {
    const vpc = N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })
    const s1 = N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.0.0/24' })
    const s2 = N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24' })
    const sub = N('subnet-9', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24' })
    applyInheritedDefaults(sub, [vpc, s1, s2])
    expect(sub.data.config.cidr_block).toBe('10.0.1.0/24') // index 1 is the first free block
  })

  it('inherits az from an enclosing AZ box and still carves a CIDR', () => {
    const vpc = N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })
    const az = N('az-1', 'az', 'vpc-1', { az: 'b' })
    const sub = N('subnet-9', 'subnet', 'az-1', { cidr_block: '10.0.1.0/24', az: 'a' })
    applyInheritedDefaults(sub, [vpc, az])
    expect(sub.data.config.az).toBe('b')
    expect(sub.data.config.cidr_block).toBe('10.0.0.0/24')
  })

  it('counts subnets across AZ boxes when carving the next /24', () => {
    const vpc = N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })
    const azA = N('az-1', 'az', 'vpc-1', { az: 'a' })
    const s1 = N('subnet-1', 'subnet', 'az-1', { cidr_block: '10.0.0.0/24' })
    const azB = N('az-2', 'az', 'vpc-1', { az: 'b' })
    const sub = N('subnet-9', 'subnet', 'az-2', { cidr_block: '10.0.1.0/24' })
    applyInheritedDefaults(sub, [vpc, azA, s1, azB])
    expect(sub.data.config.cidr_block).toBe('10.0.1.0/24') // 10.0.0.0/24 taken by the AZ-a subnet
  })

  it('defaults an AZ box to the next unused letter in its VPC', () => {
    const vpc = N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })
    const az1 = N('az-1', 'az', 'vpc-1', { az: 'a' })
    const az2 = N('az-9', 'az', 'vpc-1', { az: 'a' }) // freshly created with the meta default
    applyInheritedDefaults(az2, [vpc, az1])
    expect(az2.data.config.az).toBe('b')
  })

  it('does nothing for a node with no parent', () => {
    const s3 = N('s3-1', 's3', undefined, {})
    applyInheritedDefaults(s3, [])
    expect(s3.data.config).toEqual({})
  })
})
