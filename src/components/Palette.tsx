import { resourceList } from '@/resources'
import { useGraphStore } from '@/store/useGraphStore'

/** The scrollable resource list — shared by the desktop aside and the mobile drawer. */
export function PaletteBody() {
  const addNode = useGraphStore((s) => s.addNode)
  const setDrawer = useGraphStore((s) => s.setDrawer)

  return (
    <div className="flex-1 space-y-1 overflow-y-auto p-2">
      {resourceList.map((meta) => {
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
  )
}

/** Desktop-only left aside; mobile renders {@link PaletteBody} inside a Drawer. */
export function Palette() {
  return (
    <aside className="hidden w-[200px] shrink-0 flex-col border-r border-surface-border bg-surface-raised md:flex">
      <div className="border-b border-surface-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        리소스
      </div>
      <PaletteBody />
    </aside>
  )
}
