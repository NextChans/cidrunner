import { Search, X } from 'lucide-react'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/resources/types'
import { useResourceSearch } from '@/hooks/useResourceSearch'
import { useGraphStore } from '@/store/useGraphStore'
import { SecurityGroupLibrary } from './SecurityGroups'

/**
 * Shared id the `/` shortcut focuses (see {@link useKeyboardShortcuts}). Only
 * the desktop aside claims it; the mobile drawer copy stays anonymous so the id
 * is unique in the DOM even though both palette bodies are always mounted.
 */
export const PALETTE_SEARCH_ID = 'palette-search'

/** Debounced live filter over the palette (ADR 0037). */
function PaletteSearch({ inputId }: { inputId?: string }) {
  const { query, setQuery, clear, active, count } = useResourceSearch()

  return (
    <div className="sticky top-0 z-10 bg-surface-raised px-2 pb-2 pt-2">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Escape clears then blurs — handled here (not the global handler)
            // so it never falls through to canvas deselect.
            if (e.key === 'Escape') {
              e.stopPropagation()
              if (query) clear()
              else e.currentTarget.blur()
            }
          }}
          placeholder="리소스 검색... (/)"
          aria-label="리소스 검색"
          className="w-full rounded-md border border-surface-border bg-surface py-1.5 pl-8 pr-8 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent-soft focus:outline-none"
          // Native clear affordances vary by browser; we render our own × button.
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="검색어 지우기"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {/* Screen-reader-only result count for the active query. */}
      <div className="sr-only" role="status" aria-live="polite">
        {active ? `${count}개의 리소스가 검색되었습니다.` : ''}
      </div>
    </div>
  )
}

/**
 * The scrollable resource list, grouped by category the way the AWS console
 * organizes services — shared by the desktop aside and the mobile drawer. A
 * debounced search input (ADR 0037) filters the list live; categories with no
 * match are hidden while a query is active.
 */
export function PaletteBody({ searchInputId }: { searchInputId?: string }) {
  const addNode = useGraphStore((s) => s.addNode)
  const setDrawer = useGraphStore((s) => s.setDrawer)
  const { results, active } = useResourceSearch()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaletteSearch inputId={searchInputId} />
      {/* The resource list scrolls INSIDE this box so the SG library below is a
          pinned footer, not a sibling the flex-1 list overflows onto (ADR 0059). */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2 pt-0">
        {CATEGORY_ORDER.map((category) => {
          const items = results.filter((m) => m.category === category)
          if (items.length === 0) return null
          return (
            <div key={category}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {CATEGORY_LABELS[category]}
              </div>
              <div className="space-y-1">
                {items.map((meta) => {
                  const Icon = meta.icon
                  return (
                    <button
                      key={meta.type}
                      type="button"
                      // Drag onto the canvas to place (nesting-aware), or click to
                      // auto-place into a valid container.
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/cidrunner', meta.type)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={() => {
                        addNode(meta.type)
                        // On mobile, adding from the drawer returns focus to the canvas.
                        setDrawer('palette', false)
                      }}
                      className="group flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-surface-border hover:bg-slate-700/50"
                      title={meta.description}
                    >
                      <Icon size={18} className={meta.color} />
                      <div className="flex flex-col leading-tight">
                        <span className="text-sm text-slate-200">{meta.label}</span>
                        <span className="text-[10px] text-slate-500">{meta.description}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {active && results.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            일치하는 리소스가 없습니다.
          </p>
        )}
      </div>
      {/* Security groups are a library of firewall rulesets (ADR 0059), not
          draggable nodes — kept out of the search-filtered resource list. */}
      {!active && <SecurityGroupLibrary />}
    </div>
  )
}

/** Desktop-only left aside; mobile renders {@link PaletteBody} inside a Drawer. */
export function Palette() {
  return (
    <aside className="hidden w-[210px] shrink-0 flex-col border-r border-surface-border bg-surface-raised md:flex">
      <div className="border-b border-surface-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        리소스
      </div>
      <PaletteBody searchInputId={PALETTE_SEARCH_ID} />
    </aside>
  )
}
