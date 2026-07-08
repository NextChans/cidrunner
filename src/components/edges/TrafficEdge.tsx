import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useGraphStore } from '@/store/useGraphStore'

/**
 * Edge renderer that draws a moving particle along its path while it is part of
 * a running traffic simulation (Phase 3). Particles are staggered by the edge's
 * position in the traced path so the request appears to flow hop by hop.
 */
export function TrafficEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const sim = useGraphStore((s) => s.simulation)
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const hop = sim?.pathEdgeIds.indexOf(id) ?? -1
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
            begin={`${hop * 0.45}s`}
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
