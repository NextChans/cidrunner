import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

/**
 * Engine-owned derived edge (ADR 0043) — currently the IGW → public-subnet
 * default route. Rendered as a thin, subtle slate dashed arrow so it reads as
 * plumbing rather than as one of the player's traffic/attachment edges. Not
 * interactive; a native `<title>` gives it a hover tooltip.
 */
export function DerivedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <g>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 4', opacity: 0.55 }}
      />
      {/* Invisible, wider hit area so the tooltip is easy to trigger. */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={12}>
        <title>라우팅 (0.0.0.0/0 → IGW)</title>
      </path>
    </g>
  )
}
