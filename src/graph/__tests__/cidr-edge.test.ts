import { describe, expect, it } from 'vitest'
import { cidrIssues, parseCidr } from '@/graph/cidr'
import { N } from './helpers'

/**
 * Edge cases for the numeric CIDR core (Sprint A coverage). parseCidr does the
 * u32 folding that every containment/overlap check depends on, so its boundary
 * behaviour (/0, /32, host-bit normalization) is worth pinning down.
 */
describe('parseCidr edge cases', () => {
  it('handles the whole-internet /0 without JS shift wraparound', () => {
    // 32-bit shifts are mod-32 in JS, so /0 needs the dedicated branch.
    expect(parseCidr('0.0.0.0/0')).toEqual({ start: 0, end: 4294967295 })
  })

  it('handles a single-host /32', () => {
    expect(parseCidr('255.255.255.255/32')).toEqual({
      start: 4294967295,
      end: 4294967295,
    })
  })

  it('normalizes host bits to the network base', () => {
    // 10.0.1.5/24 and 10.0.1.0/24 describe the same range.
    expect(parseCidr('10.0.1.5/24')).toEqual(parseCidr('10.0.1.0/24'))
  })

  it('rejects a prefix > 32 and out-of-range octets', () => {
    expect(parseCidr('10.0.0.0/40')).toBeNull()
    expect(parseCidr('256.0.0.0/16')).toBeNull()
  })
})

describe('cidrIssues boundary behaviour', () => {
  it('allows a subnet whose CIDR exactly equals the VPC CIDR', () => {
    const issues = cidrIssues([
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/24' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.0.0/24' }),
    ])
    expect(issues.size).toBe(0)
  })

  it('flags a fully-nested sibling pair on both nodes', () => {
    const issues = cidrIssues([
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24' }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/25' }),
    ])
    expect(issues.has('s1')).toBe(true)
    expect(issues.has('s2')).toBe(true)
  })

  it('allows exactly-adjacent /25 halves (no overlap)', () => {
    const issues = cidrIssues([
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/25' }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.1.128/25' }),
    ])
    expect(issues.size).toBe(0)
  })

  it('skips a subnet with no parent VPC without crashing', () => {
    const issues = cidrIssues([N('s1', 'subnet', undefined, { cidr_block: '10.0.1.0/24' })])
    expect(issues.size).toBe(0)
  })
})
