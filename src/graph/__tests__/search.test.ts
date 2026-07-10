import { describe, expect, it } from 'vitest'
import { filterResources } from '@/hooks/useResourceSearch'
import { resourceList } from '@/resources'

/** Palette search filter (ADR 0037). */
describe('resource search filter', () => {
  it('returns the full list for an empty or blank query', () => {
    expect(filterResources('')).toHaveLength(resourceList.length)
    expect(filterResources('   ')).toHaveLength(resourceList.length)
  })

  it('matches the resource type id case-insensitively (partial)', () => {
    const r = filterResources('COG')
    expect(r).toHaveLength(1)
    expect(r[0]!.type).toBe('cognito')
  })

  it('matches the original English label', () => {
    const r = filterResources('kinesis')
    expect(r.map((m) => m.type)).toContain('kinesis')
  })

  it('matches the Korean description', () => {
    const r = filterResources('시크릿')
    expect(r.map((m) => m.type)).toContain('secretsmanager')
  })

  it('matches the category label (보안·아이덴티티)', () => {
    const r = filterResources('아이덴티티')
    const types = r.map((m) => m.type)
    // The whole 보안·아이덴티티 group surfaces via the category label. Security
    // Group is no longer a palette resource (ADR 0059) — it's a library, not a node.
    expect(types).toEqual(expect.arrayContaining(['cognito', 'secretsmanager', 'kms', 'acm', 'waf']))
    expect(types).not.toContain('sg')
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterResources('xyzzy')).toHaveLength(0)
  })
})
