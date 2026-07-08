import { memo } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { getResource } from '@/resources'
import { canBeSource, canBeTarget } from '@/graph/rules'
import { getCidrIssues } from '@/graph/cidr'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'

/** Containers can't shrink below this, so their header and children stay visible. */
const MIN_CONTAINER = { width: 160, height: 100 }

/**
 * Custom React Flow node rendering an AWS resource block. Containers (VPC,
 * Subnet) render as a translucent box that visually holds child nodes and are
 * resizable while selected; everything else renders as a compact card.
 * Connection handles appear only where the edge rules allow the node to be a
 * source and/or target. During a simulation, nodes on the traced path glow
 * green and the blocking node red.
 */
function ResourceNodeComponent({ id, data, selected }: NodeProps<ResourceNodeType>) {
  const meta = getResource(data.type)
  const Icon = meta.icon
  const showSource = canBeSource(data.type)
  const showTarget = canBeTarget(data.type)
  const cidrInvalid = useGraphStore((s) => (getCidrIssues(s.nodes).get(id)?.length ?? 0) > 0)
  const invalid = cidrInvalid || (meta.validate?.(data.config) ?? []).length > 0
  const sim = useGraphStore((s) => s.simulation)
  const blocked = sim?.blockedNodeId === id
  const onPath = !blocked && (sim?.pathNodeIds.includes(id) ?? false)

  if (meta.container) {
    return (
      <div
        className={clsx(
          'h-full w-full rounded-lg border-2 border-dashed bg-slate-800/20 p-2 transition-colors',
          blocked
            ? 'border-rose-500'
            : onPath
              ? 'border-accent-soft'
              : invalid
                ? 'border-rose-500'
                : selected
                  ? 'border-accent'
                  : 'border-slate-600',
        )}
      >
        <NodeResizer
          isVisible={selected ?? false}
          minWidth={MIN_CONTAINER.width}
          minHeight={MIN_CONTAINER.height}
          lineStyle={{ borderColor: '#10b981' }}
          handleStyle={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: '#10b981',
            border: '1px solid #0f172a',
          }}
        />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Icon size={16} className={meta.color} />
          <span className="text-slate-300">{data.label}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex min-w-[140px] items-center gap-2 rounded-lg border bg-surface-raised px-3 py-2 shadow-lg transition-colors',
        blocked
          ? 'border-rose-500 ring-2 ring-rose-500 animate-pulse'
          : onPath
            ? 'border-accent-soft ring-2 ring-accent-soft'
            : invalid
              ? 'border-rose-500 ring-1 ring-rose-500'
              : selected
                ? 'border-accent ring-1 ring-accent'
                : 'border-surface-border',
      )}
    >
      {showTarget && <Handle type="target" position={Position.Left} className="!bg-accent" />}
      <Icon size={18} className={meta.color} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-slate-100">{data.label}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {data.type}
        </span>
      </div>
      {showSource && <Handle type="source" position={Position.Right} className="!bg-accent" />}
    </div>
  )
}

export const ResourceNode = memo(ResourceNodeComponent)
