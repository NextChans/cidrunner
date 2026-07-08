import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useGraphStore } from '@/store/useGraphStore'
import { HOP_SECONDS } from '@/graph/simulate'

/**
 * Edge renderer. Security-Group edges (source = SG) render as a dashed rose
 * *attachment* line — they carry no traffic (ADR 0017). Traffic edges draw a
 * moving particle while part of a running simulation, staggered by their hop
 * index so the request appears to flow hop by hop (ADR 0018).
 */
export function TrafficEdge({
  id,
  source,
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

  const hop = sim?.edgeHops[id] ?? -1
  const active = hop >= 0
  const pathId = `traffic-path-${id}`

  return (
    <>
      <BaseEdge
        id={pathId}
        path={edgePath}
        markerEnd={markerEnd}
        style={active ? { stroke: '#34d399', strokeWidth: 2 } : undefined}
      />
      {active && (
        <circle r={4} fill="#34d399">
          <animateMotion
            dur="1.4s"
            begin={`${hop * HOP_SECONDS}s`}
            repeatCount="indefinite"
            rotate="auto"
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      )}
    </>
  )
}
