import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useGraphStore } from '@/store/useGraphStore'
import { HOP_SECONDS } from '@/graph/simulate'

/** Animation cycle length for particles and in/out pulses. */
const CYCLE = 1.4
/** Traffic on a successful flow vs. a blocked one (ADR 0049). */
const OK_COLOR = '#34d399'
const BLOCKED_COLOR = '#fb7185'

/**
 * Edge renderer. Security-Group edges (source = SG) render as a dashed rose
 * *attachment* line — they carry no traffic (ADR 0017). Traffic edges draw a
 * moving particle while part of a running simulation, plus directional in/out
 * pulses at the source and target handles (ADR 0049): an expanding ring where
 * traffic leaves the source and a converging ring where it arrives at the
 * target, tinted green on a reachable path and red on a blocked one.
 *
 * Edges leaving an active load balancer are staggered by their round-robin slot
 * (ADR 0048) so the balancer visibly distributes across all of its targets, not
 * just the one on the traced success path.
 */
export function TrafficEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const sim = useGraphStore((s) => s.simulation)
  const isAttachment = useGraphStore(
    (s) => s.nodes.find((n) => n.id === source)?.data.type === 'sg',
  )
  const isReplication = useGraphStore(
    (s) =>
      s.nodes.find((n) => n.id === source)?.data.type === 'rds' &&
      s.nodes.find((n) => n.id === target)?.data.type === 'rds',
  )
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  if (isAttachment) {
    return (
      <BaseEdge
        id={`attach-${id}`}
        path={edgePath}
        style={{ stroke: '#fb7185', strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.7 }}
      />
    )
  }

  // Replication link (primary → read replica): indigo dashed, no traffic.
  if (isReplication) {
    return (
      <BaseEdge
        id={`repl-${id}`}
        path={edgePath}
        style={{ stroke: '#818cf8', strokeWidth: 1.5, strokeDasharray: '6 3', opacity: 0.8 }}
      />
    )
  }

  const hop = sim?.edgeHops[id] ?? -1
  const fan = sim?.fanout[id]
  const active = hop >= 0 || fan !== undefined
  const status = sim?.edgeStatus[id]
  const color = status === 'blocked' ? BLOCKED_COLOR : OK_COLOR
  const pathId = `traffic-path-${id}`

  // A fan-out edge starts its cycle at its round-robin slot so siblings pulse in
  // rotation; a plain path edge starts at its hop offset so the request appears
  // to travel hop by hop.
  const begin = fan ? (fan.index / fan.total) * CYCLE : hop * HOP_SECONDS

  return (
    <>
      <BaseEdge
        id={pathId}
        path={edgePath}
        markerEnd={markerEnd}
        style={active ? { stroke: color, strokeWidth: fan ? 2.5 : 2 } : undefined}
      />
      {active && (
        <>
          {/* The travelling request. */}
          <circle r={fan ? 3.5 : 4} fill={color}>
            <animateMotion
              dur={`${CYCLE}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
              rotate="auto"
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
          {/* Outgoing: an expanding ring where traffic leaves the source. */}
          <circle cx={sourceX} cy={sourceY} fill="none" stroke={color} strokeWidth={1.5}>
            <animate
              attributeName="r"
              values="1;7"
              dur={`${CYCLE}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9;0"
              dur={`${CYCLE}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
          </circle>
          {/* Incoming: a converging ring where traffic arrives at the target. */}
          <circle cx={targetX} cy={targetY} fill="none" stroke={color} strokeWidth={1.5}>
            <animate
              attributeName="r"
              values="7;1"
              dur={`${CYCLE}s`}
              begin={`${begin + CYCLE / 2}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur={`${CYCLE}s`}
              begin={`${begin + CYCLE / 2}s`}
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}
    </>
  )
}
