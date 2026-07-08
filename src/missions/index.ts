import type { Mission } from './types'
import { tutorial } from './tutorial'
import { threeTier } from './threeTier'
import { serverless } from './serverless'
import { securityHardening } from './securityHardening'
import { staticCdn } from './staticCdn'
import { asyncPipeline } from './asyncPipeline'
import { containerWorkload } from './containerWorkload'
import { globalWeb } from './globalWeb'
import { eventDriven } from './eventDriven'
import { disasterRecovery } from './disasterRecovery'

/** Ordered list of missions shown in the MissionPanel. */
export const missions: Mission[] = [
  tutorial,
  threeTier,
  serverless,
  staticCdn,
  asyncPipeline,
  containerWorkload,
  globalWeb,
  eventDriven,
  securityHardening,
  disasterRecovery,
]

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id)
}

export type { Mission } from './types'
