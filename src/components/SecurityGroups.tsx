import { Plus, Shield, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'
import { assignedSgIds, isSgAssignable, type SecurityGroupDef } from '@/graph/securityGroups'

/**
 * Security Group UI (ADR 0059). SGs are a firewall ruleset *assigned* to
 * resources — modeled as a store collection, not a canvas node/edge. The
 * library manages the defs; the inspector section assigns them to the selected
 * resource; colored shield chips make assignment (and sharing) visible on the
 * node. This deliberately uses no edges: an SG is a many-to-many label, not a
 * directional flow.
 */

/** Deterministic chip palette so the same SG reads the same everywhere. */
const SG_COLORS = [
  { dot: 'bg-rose-400', chip: 'border-rose-400/50 bg-rose-500/15 text-rose-200' },
  { dot: 'bg-sky-400', chip: 'border-sky-400/50 bg-sky-500/15 text-sky-200' },
  { dot: 'bg-amber-400', chip: 'border-amber-400/50 bg-amber-500/15 text-amber-200' },
  { dot: 'bg-violet-400', chip: 'border-violet-400/50 bg-violet-500/15 text-violet-200' },
  { dot: 'bg-emerald-400', chip: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' },
  { dot: 'bg-fuchsia-400', chip: 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200' },
]

export function sgColor(sgId: string, securityGroups: SecurityGroupDef[]) {
  const i = securityGroups.findIndex((sg) => sg.id === sgId)
  return SG_COLORS[(i < 0 ? 0 : i) % SG_COLORS.length]!
}

/** A single rule toggle inside a library card. */
function RuleToggle({
  label,
  on,
  danger,
  onToggle,
}: {
  label: string
  on: boolean
  danger?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={clsx(
        'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
        on
          ? danger
            ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50'
            : 'bg-accent/20 text-accent ring-1 ring-accent/50'
          : 'bg-slate-700/50 text-slate-400',
      )}
    >
      {label}
    </button>
  )
}

/**
 * The Security Group library — create/name/edit/delete SG defs and their inbound
 * rules. Lives at the bottom of the palette (a "library", not draggable nodes).
 */
export function SecurityGroupLibrary() {
  const securityGroups = useGraphStore((s) => s.securityGroups)
  const nodes = useGraphStore((s) => s.nodes)
  const addSecurityGroup = useGraphStore((s) => s.addSecurityGroup)
  const updateSecurityGroup = useGraphStore((s) => s.updateSecurityGroup)
  const removeSecurityGroup = useGraphStore((s) => s.removeSecurityGroup)
  const setHighlightSg = useGraphStore((s) => s.setHighlightSg)

  const memberCount = (sgId: string) =>
    nodes.filter((n) => assignedSgIds(n).includes(sgId)).length

  return (
    <div className="border-t border-surface-border px-2 py-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Shield size={12} className="text-rose-400" />
          보안 그룹
        </div>
        <button
          type="button"
          onClick={() => addSecurityGroup()}
          className="flex items-center gap-1 rounded border border-surface-border px-1.5 py-0.5 text-[10px] text-slate-300 transition-colors hover:bg-slate-700/60"
          title="보안 그룹 추가"
        >
          <Plus size={11} />
          추가
        </button>
      </div>

      {securityGroups.length === 0 ? (
        <p className="px-1 text-[10px] leading-relaxed text-slate-500">
          방화벽 규칙 묶음입니다. 추가한 뒤 리소스를 선택해 인스펙터에서 지정하세요.
        </p>
      ) : (
        <div className="space-y-1.5">
          {securityGroups.map((sg) => {
            const color = sgColor(sg.id, securityGroups)
            const members = memberCount(sg.id)
            return (
              <div
                key={sg.id}
                className="rounded-md border border-surface-border bg-surface p-1.5"
                onMouseEnter={() => setHighlightSg(sg.id)}
                onMouseLeave={() => setHighlightSg(null)}
              >
                <div className="flex items-center gap-1.5">
                  <span className={clsx('h-2 w-2 shrink-0 rounded-full', color.dot)} />
                  <input
                    type="text"
                    value={sg.name}
                    onChange={(e) => updateSecurityGroup(sg.id, { name: e.target.value })}
                    aria-label="보안 그룹 이름"
                    className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-xs text-slate-200 outline-none focus:bg-slate-700/40"
                  />
                  <button
                    type="button"
                    onClick={() => removeSecurityGroup(sg.id)}
                    aria-label={`${sg.name} 삭제`}
                    className="rounded p-0.5 text-slate-500 transition-colors hover:bg-rose-950/40 hover:text-rose-300"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 pl-3.5">
                  <RuleToggle
                    label="HTTP"
                    on={sg.allowHttp}
                    onToggle={() => updateSecurityGroup(sg.id, { allowHttp: !sg.allowHttp })}
                  />
                  <RuleToggle
                    label="HTTPS"
                    on={sg.allowHttps}
                    onToggle={() => updateSecurityGroup(sg.id, { allowHttps: !sg.allowHttps })}
                  />
                  <RuleToggle
                    label="SSH"
                    on={sg.allowSsh}
                    danger
                    onToggle={() => updateSecurityGroup(sg.id, { allowSsh: !sg.allowSsh })}
                  />
                  <span className="ml-auto text-[9px] text-slate-500">{members}개 연결</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Inspector section: assign/unassign the library's SGs to the selected resource.
 * Only shown for SG-assignable resources (those with ENIs).
 */
export function SecurityGroupAssign({ node }: { node: ResourceNodeType }) {
  const securityGroups = useGraphStore((s) => s.securityGroups)
  const toggleNodeSecurityGroup = useGraphStore((s) => s.toggleNodeSecurityGroup)
  const addSecurityGroup = useGraphStore((s) => s.addSecurityGroup)

  if (!isSgAssignable(node.data.type)) return null
  const assigned = assignedSgIds(node)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-300">
        <Shield size={13} className="text-rose-400" />
        보안 그룹
      </div>
      {securityGroups.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            const id = addSecurityGroup()
            toggleNodeSecurityGroup(node.id, id)
          }}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-surface-border px-2 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-accent hover:text-slate-200"
        >
          <Plus size={12} />
          보안 그룹 만들어 지정
        </button>
      ) : (
        <div className="flex flex-wrap gap-1">
          {securityGroups.map((sg) => {
            const on = assigned.includes(sg.id)
            const color = sgColor(sg.id, securityGroups)
            return (
              <button
                key={sg.id}
                type="button"
                onClick={() => toggleNodeSecurityGroup(node.id, sg.id)}
                aria-pressed={on}
                className={clsx(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  on
                    ? color.chip
                    : 'border-surface-border bg-surface text-slate-400 hover:text-slate-200',
                )}
              >
                <span className={clsx('h-1.5 w-1.5 rounded-full', color.dot)} />
                {sg.name}
              </button>
            )
          })}
        </div>
      )}
      {assigned.length === 0 && (
        <p className="text-[10px] text-amber-300/80">⚠ 지정된 보안 그룹이 없습니다.</p>
      )}
    </div>
  )
}
