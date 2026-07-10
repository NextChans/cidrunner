import { memo } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { getResource } from '@/resources'
import { canBeSource, canBeTarget } from '@/graph/rules'
import { getGraphIssues } from '@/graph/checks'
import { DERIVED_SOURCE_HANDLE, DERIVED_TARGET_HANDLE } from '@/graph/derived'
import { assignedSgIds } from '@/graph/securityGroups'
import { useGraphStore, type ResourceNodeType } from '@/store/useGraphStore'
import { sgColor } from '../SecurityGroups'

/** Containers can't shrink below this, so their header and children stay visible. */
const MIN_CONTAINER = { width: 160, height: 100 }

/**
 * Hidden, non-connectable handle pair for engine-owned derived edges (ADR 0043)
 * to anchor to — every node carries them, including IGWs (no edge source) and
 * containers (no interactive handle at all). Inert: opacity 0, no pointer events.
 */
function DerivedHandles() {
  return (
    <>
      <Handle
        id={DERIVED_TARGET_HANDLE}
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!pointer-events-none !h-px !w-px !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        id={DERIVED_SOURCE_HANDLE}
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!pointer-events-none !h-px !w-px !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
    </>
  )
}

/**
 * Custom React Flow node rendering an AWS resource block. Containers (VPC,
 * Subnet) render as a translucent box that visually holds child nodes and are
 * resizable while selected; everything else renders as a compact card.
 * Validation state is visual: red = error, amber = security/best-practice
 * warning. During a simulation, path nodes glow green with an arrival pulse
 * and blocking nodes pulse red.
 */
function ResourceNodeComponent({ id, data, selected }: NodeProps<ResourceNodeType>) {
  const meta = getResource(data.type)
  const Icon = meta.icon
  const showSource = canBeSource(data.type)
  const showTarget = canBeTarget(data.type)
  const hasError = useGraphStore(
    (s) => (getGraphIssues(s.nodes, s.edges, s.securityGroups).errors.get(id)?.length ?? 0) > 0,
  )
  const hasWarning = useGraphStore(
    (s) => (getGraphIssues(s.nodes, s.edges, s.securityGroups).warnings.get(id)?.length ?? 0) > 0,
  )
  const invalid = hasError || (meta.validate?.(data.config) ?? []).length > 0
  const sim = useGraphStore((s) => s.simulation)
  // Security-group assignment (ADR 0059): colored shield chips make the wearing
  // resource's SGs visible; hovering an SG in the library highlights its members.
  const securityGroups = useGraphStore((s) => s.securityGroups)
  const highlightSgId = useGraphStore((s) => s.highlightSgId)
  const sgIds = assignedSgIds({ data } as ResourceNodeType)
  const sgChips = sgIds
    .map((sgId) => securityGroups.find((sg) => sg.id === sgId))
    .filter((sg): sg is NonNullable<typeof sg> => sg !== undefined)
  const sgHighlighted = highlightSgId !== null && sgIds.includes(highlightSgId)
  // Drop-target highlight during a drag (ADR 0040): null = not the target,
  // true = a valid drop, false = the rules reject this container.
  const dropValid = useGraphStore((s) => (s.dropTarget?.id === id ? s.dropTarget.valid : null))
  // Chaos mode (ADR 0052): a node knocked out by an injected AZ failure.
  const isDead = sim?.deadNodeIds.includes(id) ?? false
  // ADR 0053: a Multi-AZ RDS that failed over (survives) / a promoted replica.
  const isFailover = sim?.failoverNodeIds.includes(id) ?? false
  const isPromoted = sim?.promotedNodeIds.includes(id) ?? false
  const blocked = !isDead && (sim?.blockedNodeIds.includes(id) ?? false)
  const onPath = !isDead && !blocked && (sim?.pathNodeIds.includes(id) ?? false)
  const arrival = sim?.arrivals[id]
  // A read replica receiving replicated data pulses indigo, one hop after its
  // primary (ADR 0019 + F3 replication-flow viz).
  const replArrival = sim?.replicaArrivals[id]
  // An RDS that is the target of an rds → rds edge is a read replica (ADR 0019).
  const isReplica = useGraphStore(
    (s) =>
      data.type === 'rds' &&
      s.edges.some(
        (e) =>
          e.target === id &&
          s.nodes.find((n) => n.id === e.source)?.data.type === 'rds',
      ),
  )

  if (meta.container) {
    return (
      <div
        className={clsx(
          'h-full w-full rounded-lg border-2 border-dashed bg-slate-800/20 p-2 transition-colors',
          isDead
            ? 'border-slate-700 opacity-40 grayscale'
            : dropValid === true
            ? 'border-accent bg-emerald-500/10 ring-2 ring-accent'
            : dropValid === false
              ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500'
              : blocked
                ? 'border-rose-500'
                : onPath
                  ? 'border-accent-soft'
                  : invalid
                    ? 'border-rose-500'
                    : hasWarning
                      ? 'border-amber-400'
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
          {hasWarning && !invalid && <span title="보안 경고">⚠️</span>}
        </div>
        <DerivedHandles />
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'relative flex min-w-[140px] items-center gap-2 rounded-lg border bg-surface-raised px-3 py-2 shadow-lg transition-colors',
        isDead
          ? 'border-slate-700 border-dashed opacity-40 grayscale'
          : blocked
            ? 'border-rose-500 ring-2 ring-rose-500 animate-pulse'
            : onPath
              ? 'border-accent-soft ring-2 ring-accent-soft'
              : invalid
                ? 'border-rose-500 ring-1 ring-rose-500'
                : hasWarning
                  ? 'border-amber-400 ring-1 ring-amber-400'
                  : selected
                    ? 'border-accent ring-1 ring-accent'
                    : 'border-surface-border',
        // Same-SG highlight (ADR 0059): outline is independent of the border/ring
        // states above, so it layers without conflicting.
        sgHighlighted && 'outline outline-2 outline-offset-2 outline-rose-400',
      )}
    >
      {/* Chaos mode (ADR 0052): a downed node from an injected AZ failure. */}
      {isDead && (
        <span
          className="pointer-events-none absolute -right-1.5 -top-1.5 text-xs"
          title="장애 영향 (AZ 다운)"
        >
          ⚡
        </span>
      )}
      {/* Arrival pulse: fires when the simulated request reaches this node. */}
      {onPath && arrival !== undefined && (
        <span
          className="sim-arrival pointer-events-none absolute inset-0 rounded-lg"
          style={{ animationDelay: `${arrival}s` }}
        />
      )}
      {/* Load-balancer distribution pulse (ADR 0048): a continuous violet ring on
          an active ALB while it fans traffic out to its targets. */}
      {data.type === 'alb' && onPath && (
        <span className="lb-pulse pointer-events-none absolute inset-0 rounded-lg" />
      )}
      {/* Replication arrival pulse (indigo): a read replica receiving data from
          its primary during a simulation. */}
      {replArrival !== undefined && (
        <span
          className="repl-arrival pointer-events-none absolute inset-0 rounded-lg"
          style={{ animationDelay: `${replArrival}s` }}
        />
      )}
      {showTarget && <Handle type="target" position={Position.Left} className="!bg-accent" />}
      <Icon size={18} className={meta.color} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-slate-100">{data.label}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {data.type}
          {isReplica && !isPromoted && (
            <span className="ml-1 rounded bg-indigo-900/70 px-1 py-px font-semibold text-indigo-300">
              REPLICA
            </span>
          )}
          {isFailover && (
            <span
              className="ml-1 rounded bg-amber-900/70 px-1 py-px font-semibold text-amber-300"
              title="Multi-AZ 자동 페일오버로 생존 (동일 엔드포인트)"
            >
              ⚡ 페일오버
            </span>
          )}
          {isPromoted && (
            <span
              className="ml-1 rounded bg-emerald-900/70 px-1 py-px font-semibold text-emerald-300"
              title="마스터 장애로 복제본이 승격됨"
            >
              ⬆ 승격
            </span>
          )}
        </span>
        {/* Assigned Security Groups (ADR 0059): colored shield chips — a resource
            wears a ruleset, it does not connect to one with an edge. */}
        {sgChips.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-0.5">
            {sgChips.map((sg) => {
              const color = sgColor(sg.id, securityGroups)
              return (
                <span
                  key={sg.id}
                  className={clsx(
                    'flex items-center gap-0.5 rounded border px-1 text-[8px] leading-tight',
                    color.chip,
                  )}
                  title={`보안 그룹: ${sg.name}`}
                >
                  <span className={clsx('h-1 w-1 rounded-full', color.dot)} />
                  {sg.name}
                </span>
              )
            })}
          </span>
        )}
      </div>
      {hasWarning && !invalid && !blocked && !onPath && (
        <span className="text-xs" title="보안 경고">
          ⚠️
        </span>
      )}
      {showSource && <Handle type="source" position={Position.Right} className="!bg-accent" />}
      <DerivedHandles />
    </div>
  )
}

export const ResourceNode = memo(ResourceNodeComponent)
