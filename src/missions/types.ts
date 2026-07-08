import type { Edge } from '@xyflow/react'
import type { ResourceType } from '@/resources/types'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { SimResult } from '@/graph/simulate'

/**
 * Inputs to a mission's clear check (Phase 5). The MissionPanel builds this from
 * the current graph plus a simulation run and a validation sweep.
 */
export interface MissionCheckContext {
  nodes: ResourceNodeType[]
  edges: Edge[]
  /** Result of running the traffic simulation on the current graph. */
  sim: SimResult
  /** True when no node has any validation error. */
  allValid: boolean
}

/**
 * A challenge-mode objective. `check` returns a 0–3 star rating for the current
 * graph; 0 means not yet cleared, ≥1 means the objective is met (Phase 5).
 */
export interface Mission {
  id: string
  title: string
  description: string
  /** Short, player-facing statement of the win condition. */
  goal: string
  /** Optional nudge shown when the player is stuck. */
  hint?: string
  /** Resources expected to appear in a correct solution. */
  requiredResources?: ResourceType[]
  /** Clear detection + star rating (0–3). Omit for descriptive-only missions. */
  check?: (ctx: MissionCheckContext) => number
}
