import { useState } from 'react'
import { Plus, Trash2, X, Link2, Play } from 'lucide-react'
import { resourceList, type ResourceType } from '@/resources'
import { encodeCustomMissionUrl, type CustomMissionSpec } from '@/missions/custom'
import { useGraphStore } from '@/store/useGraphStore'

/** Buildable resource types offered as chain steps (palette resources). */
const CHOICES = resourceList.map((m) => ({ type: m.type, label: m.label }))

/**
 * Instructor "create custom mission" modal (ADR 0065). Authors a mission from a
 * title/goal/hint + a required chain of resource types, then either starts it
 * locally or copies a `#m=` share link for students. Grading is the generic
 * 0–3★ rubric (see missions/custom).
 */
export default function CreateMission() {
  const setShowCreateMission = useGraphStore((s) => s.setShowCreateMission)
  const setCustomMission = useGraphStore((s) => s.setCustomMission)
  const setNotice = useGraphStore((s) => s.setNotice)
  const existing = useGraphStore((s) => s.customMission)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [goal, setGoal] = useState(existing?.goal ?? '')
  const [hint, setHint] = useState(existing?.hint ?? '')
  const [budget, setBudget] = useState(existing?.budget ? String(existing.budget) : '')
  const [steps, setSteps] = useState<ResourceType[]>(
    existing?.chain.map((s) => s[0]!).filter(Boolean) ?? ['alb', 'ec2', 'rds'],
  )

  const valid = title.trim() !== '' && goal.trim() !== '' && steps.length > 0

  const buildSpec = (): CustomMissionSpec => {
    const spec: CustomMissionSpec = {
      title: title.trim(),
      goal: goal.trim(),
      chain: steps.map((t) => [t]),
    }
    if (hint.trim()) spec.hint = hint.trim()
    const b = Number(budget)
    if (budget.trim() && Number.isFinite(b) && b > 0) spec.budget = b
    // Distinct chain types double as the palette hint.
    spec.requiredResources = [...new Set(steps)]
    return spec
  }

  const start = () => {
    setCustomMission(buildSpec())
    setShowCreateMission(false)
    setNotice('커스텀 미션을 시작했습니다. 챌린지 모드에서 채점됩니다.', 'info')
  }

  const copyLink = async () => {
    const url = encodeCustomMissionUrl(buildSpec())
    try {
      await navigator.clipboard.writeText(url)
      setNotice('미션 공유 링크가 클립보드에 복사되었습니다.', 'info')
    } catch {
      window.prompt('아래 링크를 복사하세요:', url)
    }
  }

  const field =
    'w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={() => setShowCreateMission(false)}
    >
      <div
        role="dialog"
        aria-label="미션 만들기"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">나만의 미션 만들기</h2>
          <button
            type="button"
            onClick={() => setShowCreateMission(false)}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
          <label className="block space-y-1">
            <span className="text-xs text-slate-300">제목</span>
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 결제 3-tier 구성하기"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-300">목표</span>
            <input
              className={field}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예: ALB → EC2 → RDS 로 트래픽이 흐르게 하세요."
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-300">힌트 (선택)</span>
            <input
              className={field}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="예: 각 계층에 Security Group을 지정하세요."
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-300">월 예산 $ (선택)</span>
            <input
              className={field}
              type="number"
              min={1}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="예: 60"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs text-slate-300">
              필수 체인 (트래픽이 이 순서로 흘러야 별 1개)
            </span>
            <div className="space-y-1.5">
              {steps.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs text-slate-500">{i + 1}</span>
                  <select
                    className={field}
                    value={t}
                    onChange={(e) =>
                      setSteps(steps.map((s, j) => (j === i ? (e.target.value as ResourceType) : s)))
                    }
                  >
                    {CHOICES.map((c) => (
                      <option key={c.type} value={c.type}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {i < steps.length - 1 && <span className="text-slate-500">→</span>}
                  <button
                    type="button"
                    onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                    disabled={steps.length <= 1}
                    className="rounded p-1 text-slate-500 transition-colors hover:bg-rose-950/40 hover:text-rose-300 disabled:opacity-30"
                    aria-label={`${i + 1}단계 삭제`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSteps([...steps, 'ec2'])}
              className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-700/60"
            >
              <Plus size={12} />
              단계 추가
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 border-t border-surface-border pt-4">
          <button
            type="button"
            onClick={start}
            disabled={!valid}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play size={14} />
            이 미션으로 시작
          </button>
          <button
            type="button"
            onClick={() => void copyLink()}
            disabled={!valid}
            className="flex items-center justify-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Link2 size={14} />
            공유 링크 복사
          </button>
        </div>
      </div>
    </div>
  )
}
