import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { getResource } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * Custom React Flow node rendering an AWS resource block.
 * `vpc` renders as a translucent container that visually holds child nodes;
 * everything else renders as a compact card.
 */
function ResourceNodeComponent({ data, selected }: NodeProps<ResourceNodeType>) {
  const meta = getResource(data.type)
  const Icon = meta.icon
  const isContainer = data.type === 'vpc'

  if (isContainer) {
    return (
      <div
        className={clsx(
          'h-full w-full rounded-lg border-2 border-dashed bg-slate-800/20 p-2 transition-colors',
          selected ? 'border-accent' : 'border-slate-600',
        )}
      >
        <Handle type="target" position={Position.Left} className="!bg-accent" />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Icon size={16} className={meta.color} />
          <span className="text-slate-300">{data.label}</span>
        </div>
        <Handle type="source" position={Position.Right} className="!bg-accent" />
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex min-w-[140px] items-center gap-2 rounded-lg border bg-surface-raised px-3 py-2 shadow-lg transition-colors',
        selected ? 'border-accent ring-1 ring-accent' : 'border-surface-border',
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-accent" />
      <Icon size={18} className={meta.color} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-slate-100">{data.label}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {data.type}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-accent" />
    </div>
  )
}

export const ResourceNode = memo(ResourceNodeComponent)
