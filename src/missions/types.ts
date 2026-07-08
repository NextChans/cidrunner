import type { ResourceType } from '@/resources/types'

/**
 * A challenge-mode objective. The `goal` describes the win condition the
 * simulator will check in a later phase; for now it is descriptive only.
 */
export interface Mission {
  id: string
  title: string
  description: string
  /** Short, player-facing statement of the win condition. */
  goal: string
  /** Optional nudge shown when the player is stuck. */
  hint?: string
  /** Resources expected to appear in a correct solution (Phase 3 check). */
  requiredResources?: ResourceType[]
}
