import { getResource } from '@/resources'
import type { PropertyField } from '@/resources/types'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'

/**
 * Renders a resource's editable properties as a form, driven entirely by
 * `ResourceMeta.fields` (Phase 2). Edits flow straight into the store, and
 * `ResourceMeta.validate` runs on every render for real-time feedback.
 */
export function PropertyForm({ node }: { node: ResourceNodeType }) {
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig)
  const meta = getResource(node.data.type)
  const fields = meta.fields ?? []
  const errors = meta.validate?.(node.data.config) ?? []

  if (fields.length === 0) {
    return (
      <p className="text-[11px] italic text-slate-600">
        이 리소스는 편집할 속성이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">속성</div>

      {fields.map((field) => (
        <Field
          key={field.key}
          field={field}
          value={node.data.config[field.key]}
          onChange={(v) => updateNodeConfig(node.id, field.key, v)}
        />
      ))}

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-rose-900/60 bg-rose-950/30 p-2">
          {errors.map((e) => (
            <li key={e} className="text-[11px] text-rose-300">
              ⚠ {e}
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
      <span className="text-xs text-slate-300">{field.label}</span>
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
