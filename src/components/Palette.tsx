import { resourceList } from '@/resources'
import { useGraphStore } from '@/store/useGraphStore'

export function Palette() {
  const addNode = useGraphStore((s) => s.addNode)

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-surface-border bg-surface-raised">
      <div className="border-b border-surface-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        리소스
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {resourceList.map((meta) => {
          const Icon = meta.icon
          return (
            <button
              key={meta.type}
              type="button"
              // Phase 1: wire up onDragStart → canvas onDrop. Click-to-add for now.
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/cidrunner', meta.type)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => addNode(meta.type)}
              className="group flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-surface-border hover:bg-slate-700/50"
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
    </aside>
  )
}
