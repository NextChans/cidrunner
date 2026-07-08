import clsx from 'clsx'
import { X } from 'lucide-react'
import { badges } from '@/graph/achievements'
import { useGraphStore } from '@/store/useGraphStore'

/**
 * Achievements drawer (ADR 0032). A lazy-loaded modal, driven by
 * `showAchievements`, listing all badges with an earned/locked state. Earned
 * state comes from the persisted `earnedBadges` set — the same set the unlock
 * toast is armed from ({@link useAchievements}) — so the list stays in lockstep
 * with what the player has actually been shown.
 */
export default function Achievements() {
  const setShowAchievements = useGraphStore((s) => s.setShowAchievements)
  const earned = useGraphStore((s) => s.earnedBadges)
  const earnedSet = new Set(earned)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={() => setShowAchievements(false)}
    >
      <div
        role="dialog"
        aria-label="배지"
        className="w-full max-w-md rounded-xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            배지{' '}
            <span className="text-sm font-normal text-slate-400">
              {earnedSet.size} / {badges.length}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setShowAchievements(false)}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {badges.map((badge) => {
            const got = earnedSet.has(badge.id)
            return (
              <li
                key={badge.id}
                className={clsx(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  got
                    ? 'border-accent-soft/60 bg-accent-dim/20'
                    : 'border-surface-border bg-surface/40',
                )}
              >
                <span
                  className={clsx(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl',
                    got ? 'bg-accent/20' : 'bg-slate-800 grayscale',
                  )}
                  aria-hidden
                >
                  {got ? badge.icon : '🔒'}
                </span>
                <div className="min-w-0">
                  <div
                    className={clsx(
                      'text-sm font-medium',
                      got ? 'text-slate-100' : 'text-slate-400',
                    )}
                  >
                    {badge.title}
                  </div>
                  <p className="text-[11px] text-slate-500">{badge.description}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-[11px] text-slate-500">
          미션을 클리어하거나 설계를 갤러리에 저장하면 배지가 열립니다.
        </p>
      </div>
    </div>
  )
}
