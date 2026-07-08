import clsx from 'clsx'
import { Target } from 'lucide-react'
import { missions } from '@/missions'
import { useGraphStore } from '@/store/useGraphStore'

export function MissionPanel() {
  const mode = useGraphStore((s) => s.mode)
  const activeMissionId = useGraphStore((s) => s.activeMissionId)
  const setActiveMission = useGraphStore((s) => s.setActiveMission)
  const setMode = useGraphStore((s) => s.setMode)

  const disabled = mode !== 'challenge'

  return (
    <div className="border-t border-surface-border">
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        미션
      </div>
      <div className="max-h-[40vh] space-y-2 overflow-y-auto px-3 pb-3">
        {missions.map((mission) => {
          const active = activeMissionId === mission.id
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
                active
                  ? 'border-accent bg-accent-dim/20'
                  : 'border-surface-border hover:border-slate-500',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                  <Target size={14} className="text-accent-soft" />
                  {mission.title}
                </span>
                {active && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                    진행 중
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{mission.description}</p>
              <p className="mt-2 text-[11px] text-accent-soft">🎯 {mission.goal}</p>
            </button>
          )
        })}
        {disabled && (
          <p className="px-1 pt-1 text-[11px] italic text-slate-600">
            미션을 시작하려면 챌린지 모드로 전환하세요.
          </p>
        )}
      </div>
    </div>
  )
}
