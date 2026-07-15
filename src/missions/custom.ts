import { resources, type ResourceType } from '@/resources'
import { b64urlEncode, b64urlDecode } from '@/graph/base64url'
import { liveChain, scopedSecurityOk } from './scope'
import type { Mission } from './types'

/**
 * Instructor custom missions (ADR 0065). A teacher authors a mission — title,
 * goal, hint, and the required topology as a chain of resource types — and
 * shares it as a `#m=` URL. Students open the link and the mission grades live
 * with the same generic 0–3★ rubric every built-in uses, because `liveChain`
 * is already data-driven (ADR 0047/0041): ★1 the chain flows, ★2 + no errors,
 * ★3 + no security warnings. No code deploy needed to add a mission.
 */

/** Synthetic id for the (single) active custom mission. */
export const CUSTOM_MISSION_ID = 'custom'

export interface CustomMissionSpec {
  title: string
  goal: string
  hint?: string
  /**
   * Required topology as a live chain: an ordered list of steps, each step a
   * non-empty set of allowed resource types (e.g. `[['alb'], ['ec2','ecs'], ['rds']]`
   * = ALB → EC2-or-ECS → RDS). Graded over the simulation's live edges.
   */
  chain: ResourceType[][]
  /** Optional palette-hint resources. */
  requiredResources?: ResourceType[]
  /** Optional monthly-cost target (readout only, not a star gate). */
  budget?: number
}

/** Validates + rebuilds a spec from untrusted JSON (a `#m=` URL), or null. */
export function sanitizeCustomMission(raw: unknown): CustomMissionSpec | null {
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Record<string, unknown>
  if (typeof s.title !== 'string' || typeof s.goal !== 'string') return null
  const isType = (v: unknown): v is ResourceType => typeof v === 'string' && v in resources
  if (!Array.isArray(s.chain)) return null
  const chain: ResourceType[][] = []
  for (const step of s.chain) {
    if (!Array.isArray(step)) return null
    const types = step.filter(isType)
    if (types.length === 0) return null // every step needs ≥1 known type
    chain.push(types)
  }
  if (chain.length === 0) return null
  const spec: CustomMissionSpec = {
    title: s.title.slice(0, 80),
    goal: s.goal.slice(0, 200),
    chain,
  }
  if (typeof s.hint === 'string') spec.hint = s.hint.slice(0, 200)
  if (Array.isArray(s.requiredResources)) {
    spec.requiredResources = s.requiredResources.filter(isType)
  }
  if (typeof s.budget === 'number' && Number.isFinite(s.budget) && s.budget > 0) {
    spec.budget = s.budget
  }
  return spec
}

/** Builds a runtime {@link Mission} from a spec, using the generic star rubric. */
export function toMission(spec: CustomMissionSpec): Mission {
  const mission: Mission = {
    id: CUSTOM_MISSION_ID,
    title: spec.title,
    description: spec.goal,
    goal: spec.goal,
    requiredResources: spec.requiredResources,
    // ★1 chain flows live · ★2 + no config/graph errors · ★3 + no security warnings.
    check: (ctx) => {
      const chain = liveChain(ctx, spec.chain)
      if (!chain) return 0
      let stars = 1
      if (ctx.allValid) stars += 1
      if (scopedSecurityOk(ctx, chain)) stars += 1
      return stars
    },
  }
  if (spec.hint) mission.hint = spec.hint
  if (spec.budget !== undefined) mission.budget = spec.budget
  return mission
}

/** Builds a shareable `#m=` URL carrying the mission spec. */
export function encodeCustomMissionUrl(spec: CustomMissionSpec): string {
  return `${location.origin}${location.pathname}#m=${b64urlEncode(JSON.stringify(spec))}`
}

/** Parses a custom mission out of `location.hash` (`#m=…`), if present + valid. */
export function customMissionFromHash(hash: string): CustomMissionSpec | null {
  const match = hash.match(/^#m=(.+)$/)
  if (!match || match[1] === undefined) return null
  const json = b64urlDecode(match[1])
  if (!json) return null
  try {
    return sanitizeCustomMission(JSON.parse(json))
  } catch {
    return null
  }
}
