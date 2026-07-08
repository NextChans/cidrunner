import { useState } from 'react'
import { MousePointer2, Spline, Play } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'

const FLAG = 'cidrunner-onboarded'

/**
 * First-visit welcome overlay (ADR 0023). Teaches the three ideas newcomers
 * miss — drag-to-nest, "connections are edges (Security Groups too)", and
 * playback — then hands off to the tutorial mission or free mode. Shown once;
 * suppressed when the session started from a shared link.
 */
export function Onboarding({ suppressed }: { suppressed: boolean }) {
  const [open, setOpen] = useState(() => localStorage.getItem(FLAG) === null)
  const setMode = useGraphStore((s) => s.setMode)
  const setActiveMission = useGraphStore((s) => s.setActiveMission)
  const setDrawer = useGraphStore((s) => s.setDrawer)

  if (!open || suppressed) return null

  const dismiss = () => {
    localStorage.setItem(FLAG, '1')
    setOpen(false)
  }

  const startTutorial = () => {
    setMode('challenge')
    setActiveMission('tutorial')
    // On mobile the missions live in a drawer — surface it so the goal is visible.
    if (window.matchMedia('(max-width: 767px)').matches) setDrawer('missions', true)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-100">
          cidrunner에 오신 것을 환영합니다 👋
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          AWS 인프라를 블록으로 조립하고, 재생하고, Terraform으로 내보내는 시뮬레이션입니다.
        </p>

        <ul className="mt-4 space-y-3 text-sm text-slate-200">
          <li className="flex items-start gap-3">
            <MousePointer2 size={16} className="mt-0.5 shrink-0 text-accent-soft" />
            <span>
              팔레트에서 리소스를 <b>드래그</b>해 배치합니다. Subnet은 VPC <b>안에</b>, EC2는
              Subnet 안에 중첩됩니다.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Spline size={16} className="mt-0.5 shrink-0 text-rose-300" />
            <span>
              연결은 노드 가장자리 <b>핸들을 드래그</b>해 만듭니다.{' '}
              <b>Security Group도 엣지로 연결</b>해 리소스에 부착합니다 — 콘솔과 다른 이
              도구만의 문법입니다.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Play size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <b>시작</b>을 누르면 트래픽이 흐르는 모습이 재생되고, 완성한 설계는{' '}
              <b>Terraform으로 내보내</b> 실제로 배포할 수 있습니다. 실수는{' '}
              <b>Ctrl+Z</b>로 되돌립니다.
            </span>
          </li>
        </ul>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={startTutorial}
            className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-accent-soft"
          >
            튜토리얼 미션 시작
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md border border-surface-border px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700/60"
          >
            자유롭게 시작
          </button>
        </div>
      </div>
    </div>
  )
}
