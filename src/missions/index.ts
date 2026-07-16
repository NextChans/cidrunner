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
import { dataPipeline } from './dataPipeline'
import { secureAuthWeb } from './secureAuthWeb'
import { haSurvival } from './haSurvival'
import { leanServerless } from './leanServerless'
import { wellArchitectedReview } from './wellArchitectedReview'

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
  dataPipeline,
  secureAuthWeb,
  // 운영 챌린지 티어 (ADR 0057) — 비용·카오스가 별점 게이트가 되는 미션들.
  haSurvival,
  leanServerless,
  // 캡스톤 (ADR 0067) — Well-Architected 등급(ADR 0054)을 별점으로 소비.
  wellArchitectedReview,
]

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id)
}

export type { Mission } from './types'
