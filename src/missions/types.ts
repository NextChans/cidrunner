import type { Edge } from '@xyflow/react'
import type { ResourceType } from '@/resources/types'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { SimResult } from '@/graph/simulate'
import type { GraphIssues } from '@/graph/checks'

/**
 * Inputs to a mission's clear check (Phase 5 / ADR 0014). The MissionPanel
 * builds this from the current graph plus a simulation run and the graph-level
 * validation sweep (ADR 0017).
 */
export interface MissionCheckContext {
  nodes: ResourceNodeType[]
  edges: Edge[]
  /** Result of running the traffic simulation on the current graph. */
  sim: SimResult
  /** True when no node has any validation error (config, required, graph). */
  allValid: boolean
  /** True when no node carries a security/best-practice warning. */
  securityOk: boolean
  /** Full issue maps for missions that need specifics. */
  issues: GraphIssues
}

/**
 * One step of an interactive, self-checking walkthrough (ADR 0030). `done`
 * re-evaluates against the live graph, so the MissionPanel can tick steps off
 * and surface the next instruction as the player builds.
 */
export interface TutorialStep {
  /** Imperative, player-facing instruction for this step. */
  text: string
  /** True once the current graph satisfies this step. */
  done: (ctx: MissionCheckContext) => boolean
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
  /**
   * Optional step-by-step walkthrough (ADR 0030). Backward-compatible: only the
   * tutorial mission fills this; missions without it behave exactly as before.
   */
  steps?: TutorialStep[]
  /** Resources expected to appear in a correct solution. */
  requiredResources?: ResourceType[]
  /** Clear detection + star rating (0–3). Omit for descriptive-only missions. */
  check?: (ctx: MissionCheckContext) => number
}
