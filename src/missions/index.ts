import type { Mission } from './types'
import { tutorial } from './tutorial'
import { threeTier } from './threeTier'
import { serverless } from './serverless'
import { securityHardening } from './securityHardening'
import { staticCdn } from './staticCdn'
import { asyncPipeline } from './asyncPipeline'

/** Ordered list of missions shown in the MissionPanel. */
export const missions: Mission[] = [
  tutorial,
  threeTier,
  serverless,
  staticCdn,
  asyncPipeline,
  securityHardening,
]

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id)
}

export type { Mission } from './types'
