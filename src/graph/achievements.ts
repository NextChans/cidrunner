/**
 * Achievements / badges (ADR 0032). Badges are PURE, DERIVED state: each one is
 * a predicate over already-persisted progress (best-star records + saved gallery
 * slots), so we never touch the mission clear/star logic (ADR 0014) and never
 * introduce a second source of truth. The store only persists *which* badges
 * have been announced, so a newly-satisfied predicate can fire a one-time toast.
 */

/** Everything a badge predicate is allowed to look at. */
export interface BadgeContext {
  /** Best star record per mission id (0–3), as persisted by the store. */
  bestStars: Record<string, number>
  /** Number of saved gallery slots (ADR 0033). */
  slotCount: number
  /** Total number of missions in the catalogue (denominator for "all"). */
  missionCount: number
}

export interface Badge {
  id: string
  /** Emoji shown as the badge face — no icon asset needed. */
  icon: string
  title: string
  description: string
  /** True once the player's progress satisfies this badge. */
  earned: (ctx: BadgeContext) => boolean
}

/** Count of missions cleared to at least `min` stars. */
function starsAtLeast(bestStars: Record<string, number>, min: number): number {
  return Object.values(bestStars).filter((s) => s >= min).length
}

/**
 * The five badges (ADR 0032). Ordered from easiest to hardest so the drawer
 * reads as a progression. Kept intentionally small and all derivable from
 * existing state — no new counters, no hooks into mission grading.
 */
export const badges: Badge[] = [
  {
    id: 'first-mission',
    icon: '🥇',
    title: '첫 미션 클리어',
    description: '첫 번째 미션을 클리어했습니다.',
    earned: (c) => starsAtLeast(c.bestStars, 1) >= 1,
  },
  {
    id: 'first-three-star',
    icon: '⭐',
    title: '첫 3-star',
    description: '미션 하나를 별 3개로 완주했습니다.',
    earned: (c) => starsAtLeast(c.bestStars, 3) >= 1,
  },
  {
    id: 'first-slot',
    icon: '🎨',
    title: '갤러리 첫 저장',
    description: '설계를 갤러리 슬롯에 처음 저장했습니다.',
    earned: (c) => c.slotCount >= 1,
  },
  {
    id: 'five-missions',
    icon: '🎯',
    title: '미션 5개 완주',
    description: '서로 다른 미션 5개를 클리어했습니다.',
    earned: (c) => starsAtLeast(c.bestStars, 1) >= 5,
  },
  {
    id: 'all-three-star',
    icon: '🏆',
    title: '전 미션 3-star',
    description: '모든 미션을 별 3개로 완주했습니다.',
    earned: (c) => c.missionCount > 0 && starsAtLeast(c.bestStars, 3) >= c.missionCount,
  },
]

export function getBadge(id: string): Badge | undefined {
  return badges.find((b) => b.id === id)
}

/** Ids of every badge currently satisfied by `ctx`. */
export function earnedBadgeIds(ctx: BadgeContext): string[] {
  return badges.filter((b) => b.earned(ctx)).map((b) => b.id)
}
