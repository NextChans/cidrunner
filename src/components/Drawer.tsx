import { useEffect } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'

type DrawerSide = 'left' | 'right' | 'bottom'

interface DrawerProps {
  open: boolean
  onClose: () => void
  side: DrawerSide
  title?: string
  children: React.ReactNode
}

/**
 * Where the panel docks, plus the off-screen transform used when closed.
 * The transform is applied as an inline style (not a Tailwind `translate-*`
 * utility): those utilities all emit the same `translate(var(--tw-translate-x)…)`
 * string and only swap a CSS variable, which a CSS transition will not
 * re-interpolate — leaving the panel stuck off-screen. Distinct inline strings
 * transition reliably.
 */
const PANEL: Record<DrawerSide, { dock: string; hidden: string }> = {
  left: { dock: 'inset-y-0 left-0 w-[82vw] max-w-[320px] border-r', hidden: 'translate3d(-100%,0,0)' },
  right: { dock: 'inset-y-0 right-0 w-[82vw] max-w-[320px] border-l', hidden: 'translate3d(100%,0,0)' },
  bottom: {
    dock: 'inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl border-t',
    hidden: 'translate3d(0,100%,0)',
  },
}

/**
 * Self-contained overlay drawer that hosts the side panels on mobile.
 * Slides in from `side`; closes on backdrop click or Escape.
 *
 * The overlay is always mounted and animated purely with CSS transitions —
 * when closed it is off-screen AND `pointer-events-none`, so it can never
 * intercept canvas taps. (An `AnimatePresence`-driven version left an invisible
 * exiting overlay behind under React 19 StrictMode, blocking the canvas.)
 * Only visible below `md`; desktop keeps the static 3-pane layout.
 */
export function Drawer({ open, onClose, side, title, children }: DrawerProps) {
  // Escape closes; body scroll is locked while the drawer is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const panel = PANEL[side]

  return (
    <div
      className={clsx('fixed inset-0 z-50 md:hidden', !open && 'pointer-events-none')}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sliding panel */}
      <div
        className={clsx(
          'absolute flex flex-col border-surface-border bg-surface-raised text-slate-200 shadow-2xl transition-transform duration-200 ease-out',
          panel.dock,
        )}
        style={{ transform: open ? 'translate3d(0,0,0)' : panel.hidden }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
