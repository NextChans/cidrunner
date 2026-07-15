import { useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { Target, Star, CheckCircle2, Circle, ArrowRightCircle, Plus } from 'lucide-react'
import { missions } from '@/missions'
import { toMission, CUSTOM_MISSION_ID } from '@/missions/custom'
import type { Mission, MissionCheckContext } from '@/missions/types'
import { getResource } from '@/resources'
import { simulate } from '@/graph/simulate'
import { getGraphIssues } from '@/graph/checks'
import { estimateMonthlyCost } from '@/graph/cost'
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

/**
 * Live, self-checking walkthrough for the active mission (ADR 0030). Renders
 * `mission.steps` as a checklist; each step re-evaluates against `ctx`, so
 * completed steps tick off and the first unfinished step is highlighted as the
 * "next" instruction while the player builds.
 */
function TutorialSteps({ steps, ctx }: { steps: NonNullable<Mission['steps']>; ctx: MissionCheckContext }) {
  const nextIndex = steps.findIndex((s) => !s.done(ctx))
  return (
    <ol className="mt-2 space-y-1 border-t border-white/10 pt-2">
      {steps.map((step, i) => {
        const done = step.done(ctx)
        const isNext = i === nextIndex
        const Icon = done ? CheckCircle2 : isNext ? ArrowRightCircle : Circle
        return (
          <li
            key={i}
            className={clsx(
              'flex items-start gap-1.5 text-[11px] leading-snug',
              done
                ? 'text-slate-500 line-through'
                : isNext
                  ? 'font-medium text-accent-soft'
                  : 'text-slate-400',
            )}
          >
            <Icon
              size={13}
              className={clsx(
                'mt-px shrink-0',
                done ? 'text-accent' : isNext ? 'text-accent-soft' : 'text-slate-600',
              )}
            />
            <span>{step.text}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** The mission cards list — shared by the desktop panel and the mobile bottom sheet. */
export function MissionList() {
  const mode = useGraphStore((s) => s.mode)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const securityGroups = useGraphStore((s) => s.securityGroups)
  const activeMissionId = useGraphStore((s) => s.activeMissionId)
  const setActiveMission = useGraphStore((s) => s.setActiveMission)
  const setMode = useGraphStore((s) => s.setMode)
  const bestStars = useGraphStore((s) => s.bestStars)
  const recordStars = useGraphStore((s) => s.recordStars)
  const customMission = useGraphStore((s) => s.customMission)
  const setShowCreateMission = useGraphStore((s) => s.setShowCreateMission)

  const disabled = mode !== 'challenge'

  // The active custom mission (ADR 0065) is graded live alongside the built-ins,
  // shown first so an opened `#m=` link is front and centre.
  const allMissions = useMemo<Mission[]>(
    () => (customMission ? [toMission(customMission), ...missions] : missions),
    [customMission],
  )

  // Live clear-check context: simulate the graph and sweep validation once
  // (per-node config checks plus graph-level errors and security warnings).
  const ctx = useMemo<MissionCheckContext>(() => {
    const issues = getGraphIssues(nodes, edges, securityGroups)
    const allValid = nodes.every(
      (n) =>
        (getResource(n.data.type).validate?.(n.data.config) ?? []).length === 0 &&
        (issues.errors.get(n.id)?.length ?? 0) === 0,
    )
    const securityOk = nodes.every((n) => (issues.warnings.get(n.id)?.length ?? 0) === 0)
    return {
      nodes,
      edges,
      securityGroups,
      sim: simulate(nodes, edges),
      allValid,
      securityOk,
      issues,
    }
  }, [nodes, edges, securityGroups])

  // Budget mode (ADR 0051): live monthly-cost estimate, shown against a
  // mission's optional budget target.
  const monthlyCost = useMemo(() => estimateMonthlyCost(nodes), [nodes])

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
      <button
        type="button"
        onClick={() => setShowCreateMission(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-surface-border px-3 py-2 text-xs text-slate-300 transition-colors hover:border-accent hover:text-slate-100"
      >
        <Plus size={13} />
        나만의 미션 만들기
      </button>
      {allMissions.map((mission) => {
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
                {mission.id === CUSTOM_MISSION_ID && (
                  <span className="rounded bg-violet-900/70 px-1.5 py-0.5 text-[9px] font-semibold text-violet-200">
                    커스텀
                  </span>
                )}
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
                  <Stars earned={bestStars[mission.id] ?? 0} />
                </span>
              ) : (
                <Stars earned={0} />
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{mission.description}</p>
            <p className="mt-2 text-[11px] text-accent-soft">🎯 {mission.goal}</p>
            {mission.budget !== undefined && (
              <p
                className={clsx(
                  'mt-1 text-[11px]',
                  monthlyCost > mission.budget ? 'text-rose-300' : 'text-emerald-300',
                )}
              >
                💸 예산 ${mission.budget} · 현재 ${monthlyCost}
                {monthlyCost > mission.budget ? ' (초과)' : ' ✓'}
              </p>
            )}
            {active && mission.steps && <TutorialSteps steps={mission.steps} ctx={ctx} />}
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

/**
 * Desktop mission section, nested at the bottom of the Inspector aside. The
 * section is capped at 40vh and scrolls INTERNALLY — the wrapper needs its own
 * overflow, otherwise the (now six) mission cards pour out of the aside and
 * grow the whole page (the scroll bug fixed in ADR 0023 follow-up).
 */
export function MissionPanel() {
  return (
    <div className="flex max-h-[40vh] shrink-0 flex-col border-t border-surface-border">
      <div className="shrink-0 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        미션
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MissionList />
      </div>
    </div>
  )
}
