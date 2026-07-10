import { describe, expect, it } from 'vitest'
import { canBeTopLevel, canConnect, canContain, isContainer } from '@/graph/rules'

describe('graph rules', () => {
  it('enforces nesting: subnet in vpc, compute in subnet', () => {
    expect(canContain('vpc', 'subnet')).toBe(true)
    expect(canContain('subnet', 'ec2')).toBe(true)
    expect(canContain('subnet', 'vpc')).toBe(false)
    expect(canContain('vpc', 'ec2')).toBe(false)
  })

  it('enforces top-level placement', () => {
    expect(canBeTopLevel('vpc')).toBe(true)
    expect(canBeTopLevel('s3')).toBe(true)
    expect(canBeTopLevel('lambda')).toBe(true)
    expect(canBeTopLevel('ec2')).toBe(false)
    expect(canBeTopLevel('subnet')).toBe(false)
  })

  it('nests the organizational boxes: Account ▸ VPC ▸ AZ ▸ Subnet (ADR 0050)', () => {
    expect(canBeTopLevel('account')).toBe(true)
    expect(canBeTopLevel('az')).toBe(false) // an AZ box only lives inside a VPC
    expect(canContain('account', 'vpc')).toBe(true)
    expect(canContain('vpc', 'az')).toBe(true)
    expect(canContain('az', 'subnet')).toBe(true)
    // Additive: a Subnet still nests directly in a VPC, and a VPC still sits at
    // the top level.
    expect(canContain('vpc', 'subnet')).toBe(true)
    // AZ boxes don't hold VPCs or leaf compute directly.
    expect(canContain('az', 'vpc')).toBe(false)
    expect(canContain('az', 'ec2')).toBe(false)
    expect(isContainer('account')).toBe(true)
    expect(isContainer('az')).toBe(true)
  })

  it('marks containers', () => {
    expect(isContainer('vpc')).toBe(true)
    expect(isContainer('subnet')).toBe(true)
    expect(isContainer('ec2')).toBe(false)
  })

  it('enforces edge rules including replication', () => {
    expect(canConnect('alb', 'ec2')).toBe(true)
    expect(canConnect('ec2', 'rds')).toBe(true)
    expect(canConnect('rds', 'rds')).toBe(true) // replication
    expect(canConnect('ec2', 'alb')).toBe(false)
    expect(canConnect('s3', 'rds')).toBe(false)
    // Security Groups are assigned, not wired (ADR 0059): no sg edges.
    expect(canConnect('sg', 'ec2')).toBe(false)
  })
})
