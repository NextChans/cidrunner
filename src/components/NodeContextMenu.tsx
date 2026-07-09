import { useState } from 'react'
import {
  Trash2,
  Copy,
  SlidersHorizontal,
  Unlink,
  Scissors,
  FolderInput,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { canContain, isContainer } from '@/graph/rules'

const MENU_W = 200
const MENU_H = 260

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
 *
 * "부모에 넣기 / 부모 변경" (ADR 0038) is the symmetric partner of "부모에서
 * 분리": it flies out the candidate containers the rules allow this node to be
 * nested into, so a detached node can always be re-attached.
 */
export default function NodeContextMenu() {
  const menu = useGraphStore((s) => s.contextMenu)
  const nodes = useGraphStore((s) => s.nodes)
  const node = useGraphStore((s) =>
    menu ? s.nodes.find((n) => n.id === menu.nodeId) : undefined,
  )
  const setContextMenu = useGraphStore((s) => s.setContextMenu)
  const removeNode = useGraphStore((s) => s.removeNode)
  const duplicateNode = useGraphStore((s) => s.duplicateNode)
  const clearNodeEdges = useGraphStore((s) => s.clearNodeEdges)
  const detachNode = useGraphStore((s) => s.detachNode)
  const attachToParent = useGraphStore((s) => s.attachToParent)
  const setSelected = useGraphStore((s) => s.setSelected)
  const [submenuOpen, setSubmenuOpen] = useState(false)

  if (!menu || !node) return null

  const id = menu.nodeId
  const close = () => setContextMenu(null)
  const run = (fn: () => void) => () => {
    fn()
    close()
  }

  // Candidate containers: allowed by the rules, not the node itself, not its
  // current parent, and not one of its own descendants (that would be a cycle).
  const descendants = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parentId && descendants.has(n.parentId) && !descendants.has(n.id)) {
        descendants.add(n.id)
        grew = true
      }
    }
  }
  const candidates = nodes.filter(
    (n) =>
      isContainer(n.data.type) &&
      canContain(n.data.type, node.data.type) &&
      n.id !== node.parentId &&
      !descendants.has(n.id),
  )

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
  // Flip the parent submenu to the left if it would overflow the viewport.
  const submenuFlipLeft = left + MENU_W + MENU_W + 8 > vw

  const rowClass = (opts: { danger?: boolean; disabled?: boolean } = {}) =>
    'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ' +
    (opts.disabled
      ? 'cursor-not-allowed text-slate-600'
      : opts.danger
        ? 'text-rose-300 hover:bg-rose-950/40'
        : 'text-slate-200 hover:bg-slate-700/60')

  return (
    <div className="fixed inset-0 z-50" onClick={close} onContextMenu={(e) => e.preventDefault()}>
      <ul
        role="menu"
        style={{ left, top, width: MENU_W }}
        className="absolute overflow-visible rounded-md border border-surface-border bg-surface-raised py-1 text-sm shadow-2xl"
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
                className={rowClass(item)}
              >
                <Icon size={14} />
                {item.label}
              </button>
            </li>
          )
        })}

        {/* 부모에 넣기 / 부모 변경 — flyout of candidate containers. */}
        <li
          role="menuitem"
          className="relative"
          onMouseEnter={() => setSubmenuOpen(candidates.length > 0)}
          onMouseLeave={() => setSubmenuOpen(false)}
        >
          <button
            type="button"
            disabled={candidates.length === 0}
            className={rowClass({ disabled: candidates.length === 0 }) + ' justify-between'}
          >
            <span className="flex items-center gap-2.5">
              <FolderInput size={14} />
              {node.parentId ? '부모 변경' : '부모에 넣기'}
            </span>
            {candidates.length > 0 && <ChevronRight size={14} className="opacity-60" />}
          </button>
          {submenuOpen && candidates.length > 0 && (
            <ul
              role="menu"
              style={{ width: MENU_W }}
              className={
                'absolute top-0 max-h-64 overflow-auto rounded-md border border-surface-border bg-surface-raised py-1 shadow-2xl ' +
                (submenuFlipLeft ? 'right-full mr-1' : 'left-full ml-1')
              }
            >
              {candidates.map((c) => (
                <li key={c.id} role="menuitem">
                  <button
                    type="button"
                    onClick={run(() => attachToParent(id, c.id))}
                    className={rowClass()}
                  >
                    <span className="truncate">{c.data.label || c.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
    </div>
  )
}
