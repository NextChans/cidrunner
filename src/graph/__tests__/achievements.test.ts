import { describe, expect, it } from 'vitest'
import { badges, earnedBadgeIds, getBadge } from '@/graph/achievements'
import { missions } from '@/missions'

const M = missions.length

describe('achievements', () => {
  it('unlocks nothing on a fresh profile', () => {
    expect(earnedBadgeIds({ bestStars: {}, slotCount: 0, missionCount: M })).toEqual([])
  })

  it('first cleared mission → 첫 미션 클리어', () => {
    const ids = earnedBadgeIds({ bestStars: { 'three-tier': 1 }, slotCount: 0, missionCount: M })
    expect(ids).toContain('first-mission')
    expect(ids).not.toContain('first-three-star')
  })

  it('a single 3-star clears both first-mission and first-three-star', () => {
    const ids = earnedBadgeIds({ bestStars: { 'three-tier': 3 }, slotCount: 0, missionCount: M })
    expect(ids).toEqual(expect.arrayContaining(['first-mission', 'first-three-star']))
  })

  it('first saved slot → 갤러리 첫 저장 (independent of missions)', () => {
    const ids = earnedBadgeIds({ bestStars: {}, slotCount: 1, missionCount: M })
    expect(ids).toEqual(['first-slot'])
  })

  it('five cleared missions → 미션 5개 완주', () => {
    const bestStars = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`m${i}`, 1]),
    )
    expect(earnedBadgeIds({ bestStars, slotCount: 0, missionCount: M })).toContain('five-missions')
  })

  it('all missions at 3-star → 전 미션 3-star', () => {
    const bestStars = Object.fromEntries(missions.map((m) => [m.id, 3]))
    const ids = earnedBadgeIds({ bestStars, slotCount: 0, missionCount: M })
    expect(ids).toContain('all-three-star')
  })

  it('does not award "all 3-star" while one mission trails', () => {
    const bestStars = Object.fromEntries(missions.map((m, i) => [m.id, i === 0 ? 2 : 3]))
    const ids = earnedBadgeIds({ bestStars, slotCount: 0, missionCount: M })
    expect(ids).not.toContain('all-three-star')
  })

  it('every badge has a stable, unique id and a lookup', () => {
    const ids = badges.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of badges) expect(getBadge(b.id)).toBe(b)
  })
})
