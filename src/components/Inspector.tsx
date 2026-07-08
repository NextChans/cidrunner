import { Trash2 } from 'lucide-react'
import { getResource } from '@/resources'
import { useGraphStore } from '@/store/useGraphStore'
import { MissionPanel } from './MissionPanel'

export function Inspector() {
  const node = useGraphStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId),
  )
  const removeNode = useGraphStore((s) => s.removeNode)

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-surface-border bg-surface-raised">
      <div className="border-b border-surface-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Inspector
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {node ? (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Selected node
              </div>
              <div className="mt-1 flex items-center gap-2">
                {(() => {
                  const Icon = getResource(node.data.type).icon
                  return <Icon size={18} className={getResource(node.data.type).color} />
                })()}
                <span className="text-sm font-medium text-slate-100">
                  {node.data.label}
                </span>
              </div>
            </div>

            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">id</dt>
                <dd className="text-slate-300">{node.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">type</dt>
                <dd className="text-slate-300">{node.data.type}</dd>
              </div>
            </dl>

            {/* Phase 2: property editing form goes here. */}
            <p className="text-[11px] italic text-slate-600">
              Property editing arrives in a later phase.
            </p>

            <button
              type="button"
              onClick={() => removeNode(node.id)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-900/60 px-3 py-2 text-xs text-rose-300 transition-colors hover:bg-rose-950/40"
            >
              <Trash2 size={14} />
              Delete node
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Select a node on the canvas to inspect it.
          </p>
        )}
      </div>

      <MissionPanel />
    </aside>
  )
}
