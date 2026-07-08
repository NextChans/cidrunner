import { Trash2 } from 'lucide-react'
import { getResource } from '@/resources'
import { getCidrIssues } from '@/graph/cidr'
import { useGraphStore } from '@/store/useGraphStore'
import { MissionPanel } from './MissionPanel'
import { PropertyForm } from './PropertyForm'

/** The selected-node detail view — shared by the desktop aside and the mobile drawer. */
export function InspectorBody() {
  const node = useGraphStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId),
  )
  const removeNode = useGraphStore((s) => s.removeNode)
  const graphErrorCount = useGraphStore((s) =>
    s.selectedNodeId ? (getCidrIssues(s.nodes).get(s.selectedNodeId)?.length ?? 0) : 0,
  )

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {node ? (
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              선택된 노드
            </div>
            <div className="mt-1 flex items-center gap-2">
              {(() => {
                const meta = getResource(node.data.type)
                const Icon = meta.icon
                const invalid =
                  graphErrorCount > 0 ||
                  (meta.validate?.(node.data.config) ?? []).length > 0
                return (
                  <>
                    <Icon size={18} className={meta.color} />
                    <span className="text-sm font-medium text-slate-100">
                      {node.data.label}
                    </span>
                    {invalid && (
                      <span className="rounded-full bg-rose-900/70 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                        오류
                      </span>
                    )}
                  </>
                )
              })()}
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

          <PropertyForm node={node} />

          <button
            type="button"
            onClick={() => removeNode(node.id)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-900/60 px-3 py-2 text-xs text-rose-300 transition-colors hover:bg-rose-950/40"
          >
            <Trash2 size={14} />
            노드 삭제
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          캔버스에서 노드를 선택하면 정보를 확인할 수 있습니다.
        </p>
      )}
    </div>
  )
}

/** Desktop-only right aside; mobile renders {@link InspectorBody} inside a Drawer. */
export function Inspector() {
  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-l border-surface-border bg-surface-raised md:flex">
      <div className="border-b border-surface-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        인스펙터
      </div>

      <InspectorBody />

      <MissionPanel />
    </aside>
  )
}
