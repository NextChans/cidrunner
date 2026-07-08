import type { Mission } from './types'
import { tutorial } from './tutorial'
import { threeTier } from './threeTier'
import { serverless } from './serverless'

/** Ordered list of missions shown in the MissionPanel. */
export const missions: Mission[] = [tutorial, threeTier, serverless]

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id)
}

export type { Mission } from './types'
