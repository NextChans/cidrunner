import { getResource } from '@/resources'
import type { PropertyField } from '@/resources/types'
import { getGraphIssues } from '@/graph/checks'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'

/**
 * Renders a resource's editable properties as a form, driven entirely by
 * `ResourceMeta.fields` (Phase 2). Edits flow straight into the store.
 * Real-time feedback merges three sources: per-node `validate`, generic
 * required-field checks, and graph-level issues (errors red, security
 * warnings amber).
 */
export function PropertyForm({ node }: { node: ResourceNodeType }) {
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig)
  // Select cached arrays (or undefined) directly — defaulting to a fresh []
  // inside the selector would return a new reference every snapshot and loop.
  // Pass securityGroups (ADR 0059): omitting it lets getGraphIssues mint a fresh
  // [] default per call, invalidating its shared memo every render → #185 loop.
  const graphErrors = useGraphStore((s) =>
    getGraphIssues(s.nodes, s.edges, s.securityGroups).errors.get(node.id),
  )
  const graphWarnings = useGraphStore((s) =>
    getGraphIssues(s.nodes, s.edges, s.securityGroups).warnings.get(node.id),
  )
  const meta = getResource(node.data.type)
  const fields = meta.fields ?? []

  const requiredErrors = fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = node.data.config[f.key]
      return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
    })
    .map((f) => `${f.label}은(는) 필수 항목입니다.`)

  const errors = [
    ...requiredErrors,
    ...(meta.validate?.(node.data.config) ?? []),
    ...(graphErrors ?? []),
  ]
  const warnings = graphWarnings ?? []

  if (fields.length === 0 && errors.length === 0 && warnings.length === 0) {
    return (
      <p className="text-[11px] italic text-slate-600">
        이 리소스는 편집할 속성이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">속성</div>
          {fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={node.data.config[field.key]}
              onChange={(v) => updateNodeConfig(node.id, field.key, v)}
            />
          ))}
        </>
      )}

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-rose-900/60 bg-rose-950/30 p-2">
          {errors.map((e) => (
            <li key={e} className="text-[11px] text-rose-300">
              ⚠ {e}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-900/60 bg-amber-950/30 p-2">
          {warnings.map((w) => (
            <li key={w} className="text-[11px] text-amber-300">
              🛡 {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({
  field,
  value,
  onChange,
}: {
  field: PropertyField
  value: unknown
  onChange: (value: unknown) => void
}) {
  const inputClass =
    'w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-accent'

  if (field.type === 'boolean') {
    return (
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span className="text-xs text-slate-300">{field.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
      </label>
    )
  }

  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-300">
        {field.label}
        {field.required && <span className="text-rose-400"> *</span>}
      </span>
      {field.type === 'select' ? (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          onChange={(e) =>
            onChange(field.type === 'number' ? e.target.valueAsNumber : e.target.value)
          }
          className={inputClass}
        />
      )}
      {field.help && <span className="block text-[10px] text-slate-500">{field.help}</span>}
    </label>
  )
}
