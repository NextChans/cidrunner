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

  it('marks containers', () => {
    expect(isContainer('vpc')).toBe(true)
    expect(isContainer('subnet')).toBe(true)
    expect(isContainer('ec2')).toBe(false)
  })

  it('enforces edge rules including attachments and replication', () => {
    expect(canConnect('alb', 'ec2')).toBe(true)
    expect(canConnect('ec2', 'rds')).toBe(true)
    expect(canConnect('sg', 'ec2')).toBe(true) // attachment
    expect(canConnect('rds', 'rds')).toBe(true) // replication
    expect(canConnect('ec2', 'alb')).toBe(false)
    expect(canConnect('s3', 'rds')).toBe(false)
  })
})
