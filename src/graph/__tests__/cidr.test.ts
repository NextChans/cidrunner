import { describe, expect, it } from 'vitest'
import { cidrIssues, parseCidr } from '@/graph/cidr'
import { N } from './helpers'

describe('parseCidr', () => {
  it('parses a valid block into a numeric range', () => {
    expect(parseCidr('10.0.0.0/16')).toEqual({ start: 167772160, end: 167837695 })
  })

  it('rejects malformed input', () => {
    expect(parseCidr('300.0.0.0/16')).toBeNull()
    expect(parseCidr('10.0.0.0/33')).toBeNull()
    expect(parseCidr('junk')).toBeNull()
    expect(parseCidr(undefined)).toBeNull()
  })
})

describe('cidrIssues', () => {
  it('flags a subnet outside its VPC CIDR', () => {
    const issues = cidrIssues([
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '192.168.1.0/24' }),
    ])
    expect(issues.get('s1')?.[0]).toContain('범위를 벗어납니다')
  })

  it('flags overlapping sibling subnets on both nodes', () => {
    const issues = cidrIssues([
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24' }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.1.128/25' }),
    ])
    expect(issues.has('s1')).toBe(true)
    expect(issues.has('s2')).toBe(true)
  })

  it('allows a valid layout and cross-VPC overlap', () => {
    expect(
      cidrIssues([
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24' }),
        N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24' }),
      ]).size,
    ).toBe(0)

    expect(
      cidrIssues([
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('vpc-2', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24' }),
        N('s2', 'subnet', 'vpc-2', { cidr_block: '10.0.1.0/24' }),
      ]).size,
    ).toBe(0)
  })
})
