import type { Mission, MissionCheckContext } from './types'
import { liveChain } from './scope'
import { applyAzFault, graphAzs } from '@/graph/chaos'
import { estimateMonthlyCost } from '@/graph/cost'
import { simulate } from '@/graph/simulate'

/**
 * Ops-challenge tier (ADR 0057): the first mission whose STARS consume the
 * cost/chaos signals — the tradeoff axes (ADR 0051/0052) stop being
 * display-only here. Existing missions keep their gates untouched.
 */

const BUDGET = 90
const CHAIN = ['alb', ['ec2', 'ecs', 'eks'], 'rds'] as const

/** True when the 3-tier chain stays alive through EVERY single-AZ failure. */
function survivesEveryAzFault(ctx: MissionCheckContext): boolean {
  const azs = graphAzs(ctx.nodes)
  if (azs.length < 2) return false
  return azs.every((az) => {
    const fault = applyAzFault(ctx.nodes, ctx.edges, az)
    const sim = simulate(ctx.nodes, fault.edges, { deadNodeIds: fault.deadNodeIds })
    return liveChain({ nodes: ctx.nodes, edges: fault.edges, sim }, CHAIN) !== null
  })
}

export const haSurvival: Mission = {
  id: 'ha-survival',
  title: '⚡ 무중단 운영',
  description:
    '운영 챌린지: 어떤 가용 영역이 통째로 죽어도 서비스가 살아남아야 합니다. 이중화에는 돈이 들고, 예산은 정해져 있습니다.',
  goal: '단일 AZ 장애 어디에서도 ALB → 컴퓨팅 → RDS가 살아남게 하세요 (월 $90 이내).',
  hint: '컴퓨팅을 두 AZ에 복제하고, RDS는 Multi-AZ(2배 비용) 또는 다른 AZ의 읽기 복제본으로 지키세요. 카오스 패널로 미리 시험해볼 수 있습니다.',
  requiredResources: ['vpc', 'subnet', 'alb', 'ec2', 'rds'],
  budget: BUDGET,
  steps: [
    {
      text: 'ALB → 컴퓨팅(EC2/ECS/EKS) → RDS 체인을 완성하세요.',
      done: (ctx) => liveChain(ctx, CHAIN) !== null,
    },
    {
      text: '두 AZ로 이중화해 어떤 단일 AZ 장애에서도 체인이 생존하게 하세요.',
      done: (ctx) => survivesEveryAzFault(ctx),
    },
    {
      text: `오류 없이 월 $${BUDGET} 이내로 마무리하세요.`,
      done: (ctx) => ctx.allValid && estimateMonthlyCost(ctx.nodes) <= BUDGET,
    },
  ],
  // ★1 체인 동작 · ★2 모든 단일 AZ 장애 생존 · ★3 +오류 0·예산 내.
  // 순차 게이트: 생존(미션의 본질) 없이는 예산 별을 딸 수 없다.
  check: (ctx) => {
    if (!liveChain(ctx, CHAIN)) return 0
    if (!survivesEveryAzFault(ctx)) return 1
    return ctx.allValid && estimateMonthlyCost(ctx.nodes) <= BUDGET ? 3 : 2
  },
}
