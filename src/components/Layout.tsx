import { Waves } from 'lucide-react'
import { Toolbar } from './Toolbar'
import { Palette } from './Palette'
import { Canvas } from './Canvas'
import { Inspector } from './Inspector'

export function Layout() {
  return (
    <div className="flex h-screen flex-col bg-surface text-slate-200">
      <header className="flex items-center justify-between border-b border-surface-border bg-surface-raised px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Waves size={20} className="text-accent" />
          <h1 className="text-base font-semibold tracking-tight text-slate-100">
            cidrunner
          </h1>
          <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            Phase 1
          </span>
        </div>
        <Toolbar />
      </header>

      <main className="flex min-h-0 flex-1">
        <Palette />
        <div className="min-w-0 flex-1">
          <Canvas />
        </div>
        <Inspector />
      </main>
    </div>
  )
}
