import { describe, expect, it } from 'vitest'
import { validateCidr } from '@/resources/validators'

describe('validateCidr (apply-grade AWS rules)', () => {
  it('accepts canonical VPC/Subnet CIDRs', () => {
    expect(validateCidr('10.0.0.0/16')).toBeNull()
    expect(validateCidr('10.0.1.0/24')).toBeNull()
    expect(validateCidr('192.168.0.0/28')).toBeNull()
    expect(validateCidr('172.16.0.0/16')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(validateCidr('')).toContain('입력')
    expect(validateCidr('10.0.0.0')).toContain('형식')
    expect(validateCidr('300.0.0.0/16')).toContain('옥텟')
    expect(validateCidr(undefined)).toContain('입력')
  })

  it('rejects prefixes outside the AWS /16–/28 window', () => {
    expect(validateCidr('10.0.0.0/8')).toContain('/16–/28')
    expect(validateCidr('10.0.0.0/15')).toContain('/16–/28')
    expect(validateCidr('10.0.0.0/29')).toContain('/16–/28')
    expect(validateCidr('10.0.0.0/32')).toContain('/16–/28')
  })

  it('rejects host bits and suggests the canonical base address', () => {
    expect(validateCidr('10.0.1.5/24')).toContain('10.0.1.0/24')
    expect(validateCidr('10.0.1.5/24')).toContain('호스트 비트')
    expect(validateCidr('10.0.255.0/16')).toContain('10.0.0.0/16')
    expect(validateCidr('192.168.0.9/28')).toContain('192.168.0.0/28')
  })
})
