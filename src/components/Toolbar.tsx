import clsx from 'clsx'
import { Play, Square, RotateCcw, Download } from 'lucide-react'
import { useGraphStore, type Mode } from '@/store/useGraphStore'

const MODES: Mode[] = ['free', 'challenge']

const MODE_LABELS: Record<Mode, string> = {
  free: '자유 모드',
  challenge: '챌린지 모드',
}

export function Toolbar() {
  const mode = useGraphStore((s) => s.mode)
  const setMode = useGraphStore((s) => s.setMode)
  const reset = useGraphStore((s) => s.reset)
  const running = useGraphStore((s) => s.simulation !== null)
  const runSimulation = useGraphStore((s) => s.runSimulation)
  const stopSimulation = useGraphStore((s) => s.stopSimulation)

  return (
    <div className="flex items-center gap-3">
      {/* Free / Challenge mode toggle */}
      <div className="flex overflow-hidden rounded-md border border-surface-border text-xs">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx(
              'px-3 py-1.5 transition-colors',
              mode === m
                ? 'bg-accent text-slate-900 font-semibold'
                : 'text-slate-400 hover:bg-slate-700/60',
            )}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-surface-border" />

      <button
        type="button"
        onClick={() => (running ? stopSimulation() : runSimulation())}
        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-accent-soft"
      >
        {running ? <Square size={14} /> : <Play size={14} />}
        {running ? '중지' : '시작'}
      </button>

      <button
        type="button"
        onClick={() => reset()}
        className="flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/60"
      >
        <RotateCcw size={14} />
        초기화
      </button>

      <button
        type="button"
        // Phase 4: generate main.tf + variables.tf and zip-download.
        onClick={() => console.log('TODO: export terraform')}
        className="flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/60"
      >
        <Download size={14} />
        Terraform 내보내기
      </button>
    </div>
  )
}
