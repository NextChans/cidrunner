import { useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { Target, Star } from 'lucide-react'
import { missions } from '@/missions'
import type { MissionCheckContext } from '@/missions/types'
import { getResource } from '@/resources'
import { simulate } from '@/graph/simulate'
import { getGraphIssues } from '@/graph/checks'
import { useGraphStore } from '@/store/useGraphStore'

/** Three star slots, filling `earned` of them. */
function Stars({ earned }: { earned: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${earned}개의 별 획득`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          size={13}
          className={i < earned ? 'fill-accent text-accent' : 'text-slate-600'}
        />
      ))}
    </span>
  )
}

/** The mission cards list — shared by the desktop panel and the mobile bottom sheet. */
export function MissionList() {
  const mode = useGraphStore((s) => s.mode)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const activeMissionId = useGraphStore((s) => s.activeMissionId)
  const setActiveMission = useGraphStore((s) => s.setActiveMission)
  const setMode = useGraphStore((s) => s.setMode)
  const bestStars = useGraphStore((s) => s.bestStars)
  const recordStars = useGraphStore((s) => s.recordStars)

  const disabled = mode !== 'challenge'

  // Live clear-check context: simulate the graph and sweep validation once
  // (per-node config checks plus graph-level errors and security warnings).
  const ctx = useMemo<MissionCheckContext>(() => {
    const issues = getGraphIssues(nodes, edges)
    const allValid = nodes.every(
      (n) =>
        (getResource(n.data.type).validate?.(n.data.config) ?? []).length === 0 &&
        (issues.errors.get(n.id)?.length ?? 0) === 0,
    )
    const securityOk = nodes.every((n) => (issues.warnings.get(n.id)?.length ?? 0) === 0)
    return { nodes, edges, sim: simulate(nodes, edges), allValid, securityOk, issues }
  }, [nodes, edges])

  // Persist best star records (ADR 0023) as the live results change.
  useEffect(() => {
    for (const mission of missions) {
      const stars = mission.check?.(ctx) ?? 0
      if (stars > (useGraphStore.getState().bestStars[mission.id] ?? 0)) {
        recordStars(mission.id, stars)
      }
    }
  }, [ctx, recordStars])

  return (
    <div className="space-y-2 overflow-y-auto px-3 pb-3">
      {missions.map((mission) => {
        const active = activeMissionId === mission.id
        const stars = mission.check?.(ctx) ?? 0
        const cleared = stars >= 1
        return (
          <button
            key={mission.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (mode !== 'challenge') setMode('challenge')
              setActiveMission(active ? null : mission.id)
            }}
            className={clsx(
              'w-full rounded-md border p-3 text-left transition-colors',
              disabled && 'cursor-not-allowed opacity-50',
              cleared
                ? 'border-accent-soft bg-accent-dim/20'
                : active
                  ? 'border-accent bg-accent-dim/20'
                  : 'border-surface-border hover:border-slate-500',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <Target size={14} className="text-accent-soft" />
                {mission.title}
              </span>
              {cleared ? (
                <span className="flex items-center gap-1.5">
                  <Stars earned={stars} />
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                    완료
                  </span>
                </span>
              ) : active ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                  진행 중
                </span>
              ) : (bestStars[mission.id] ?? 0) > 0 ? (
                <span
                  className="flex items-center gap-1 text-[10px] text-slate-400"
                  title="최고 기록"
                >
                  최고
                  <Stars earned={bestStars[mission.id]} />
                </span>
              ) : (
                <Stars earned={0} />
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{mission.description}</p>
            <p className="mt-2 text-[11px] text-accent-soft">🎯 {mission.goal}</p>
            {cleared && stars < 3 && mission.hint && (
              <p className="mt-1 text-[11px] text-slate-500">💡 {mission.hint}</p>
            )}
          </button>
        )
      })}
      {disabled && (
        <p className="px-1 pt-1 text-[11px] italic text-slate-600">
          미션을 시작하려면 챌린지 모드로 전환하세요.
        </p>
      )}
    </div>
  )
}

/** Desktop mission section, nested at the bottom of the Inspector aside. */
export function MissionPanel() {
  return (
    <div className="border-t border-surface-border">
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        미션
      </div>
      <div className="max-h-[40vh]">
        <MissionList />
      </div>
    </div>
  )
}
