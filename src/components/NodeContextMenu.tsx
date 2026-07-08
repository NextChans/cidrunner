import { Trash2, Copy, SlidersHorizontal, Unlink, Scissors } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'

const MENU_W = 200
const MENU_H = 220

interface Item {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

/**
 * Node right-click menu (ADR 0028). Anchored at the click point in screen space,
 * clamped to the viewport. Closed by Escape (handled in useKeyboardShortcuts) or
 * an outside click on the backdrop. Lazy-loaded and rendered only when
 * `contextMenu` is set.
 */
export default function NodeContextMenu() {
  const menu = useGraphStore((s) => s.contextMenu)
  const node = useGraphStore((s) =>
    menu ? s.nodes.find((n) => n.id === menu.nodeId) : undefined,
  )
  const setContextMenu = useGraphStore((s) => s.setContextMenu)
  const removeNode = useGraphStore((s) => s.removeNode)
  const duplicateNode = useGraphStore((s) => s.duplicateNode)
  const clearNodeEdges = useGraphStore((s) => s.clearNodeEdges)
  const detachNode = useGraphStore((s) => s.detachNode)
  const setSelected = useGraphStore((s) => s.setSelected)

  if (!menu || !node) return null

  const id = menu.nodeId
  const close = () => setContextMenu(null)
  const run = (fn: () => void) => () => {
    fn()
    close()
  }

  const items: Item[] = [
    {
      icon: SlidersHorizontal,
      label: '속성 편집',
      onClick: run(() => setSelected(id)),
    },
    { icon: Copy, label: '복제', onClick: run(() => duplicateNode(id)) },
    { icon: Scissors, label: '엣지 지우기', onClick: run(() => clearNodeEdges(id)) },
    {
      icon: Unlink,
      label: '부모에서 분리',
      onClick: run(() => detachNode(id)),
      disabled: !node.parentId,
    },
    { icon: Trash2, label: '삭제', onClick: run(() => removeNode(id)), danger: true },
  ]

  // Keep the menu on-screen when the click lands near the right/bottom edge.
  const vw = typeof window !== 'undefined' ? window.innerWidth : MENU_W
  const vh = typeof window !== 'undefined' ? window.innerHeight : MENU_H
  const left = Math.min(menu.x, vw - MENU_W - 8)
  const top = Math.min(menu.y, vh - MENU_H - 8)

  return (
    <div className="fixed inset-0 z-50" onClick={close} onContextMenu={(e) => e.preventDefault()}>
      <ul
        role="menu"
        style={{ left, top, width: MENU_W }}
        className="absolute overflow-hidden rounded-md border border-surface-border bg-surface-raised py-1 text-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <li className="truncate px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
          {node.data.label || node.id}
        </li>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.label} role="menuitem">
              <button
                type="button"
                disabled={item.disabled}
                onClick={item.onClick}
                className={
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ' +
                  (item.disabled
                    ? 'cursor-not-allowed text-slate-600'
                    : item.danger
                      ? 'text-rose-300 hover:bg-rose-950/40'
                      : 'text-slate-200 hover:bg-slate-700/60')
                }
              >
                <Icon size={14} />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
