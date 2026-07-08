import { useEffect, useRef } from 'react'
import { missions } from '@/missions'
import { badges, earnedBadgeIds, getBadge } from '@/graph/achievements'
import { useGraphStore } from '@/store/useGraphStore'

/**
 * Watches derived badge state (ADR 0032) and fires a one-time toast when a new
 * badge is earned. Mounted once (in App). The first pass silently backfills
 * badges already satisfied by pre-existing progress — retroactive unlocks must
 * NOT spam the player with toasts on load; only unlocks earned *during* the
 * session announce themselves.
 */
export function useAchievements() {
  const bestStars = useGraphStore((s) => s.bestStars)
  const slotCount = useGraphStore((s) => s.slots.length)
  const earned = useGraphStore((s) => s.earnedBadges)
  const markBadges = useGraphStore((s) => s.markBadges)
  const setNotice = useGraphStore((s) => s.setNotice)
  const mounted = useRef(false)

  useEffect(() => {
    const derived = earnedBadgeIds({ bestStars, slotCount, missionCount: missions.length })
    const fresh = derived.filter((id) => !earned.includes(id))

    if (fresh.length > 0) markBadges(fresh)

    // First run = mount: backfill silently, then arm announcements.
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (fresh.length === 0) return

    const lastId = fresh[fresh.length - 1]
    const last = lastId ? getBadge(lastId) : undefined
    const text =
      fresh.length === 1 && last
        ? `🎉 배지 획득: ${last.icon} ${last.title}`
        : `🎉 새 배지 ${fresh.length}개 획득!`
    setNotice(text, 'info')
  }, [bestStars, slotCount, earned, markBadges, setNotice])

  // Kept for symmetry with other hooks; the total count drives the toolbar chip.
  return { earnedCount: earned.length, total: badges.length }
}
