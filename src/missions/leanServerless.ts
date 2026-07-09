import type { Mission } from './types'
import { liveChain } from './scope'
import { estimateMonthlyCost } from '@/graph/cost'

/**
 * Ops-challenge tier (ADR 0057): the cost axis (ADR 0051) as a hard star gate.
 * The lesson is architectural frugality — the same API is ~$1/month serverless
 * and ~$50+ rebuilt on EC2 behind an ALB with a NAT.
 */

const BUDGET = 5
const CHAIN = ['apigw', 'lambda', ['dynamodb', 's3']] as const

export const leanServerless: Mission = {
  id: 'lean-serverless',
  title: '💸 린 서버리스',
  description:
    '운영 챌린지: 스타트업 초기, 인프라 예산은 월 $5입니다. 동작하는 API를 그 안에서 만드세요 — 시간당 과금 블록은 하나만 넣어도 예산이 터집니다.',
  goal: 'API Gateway → Lambda → DynamoDB/S3 를 월 $5 이내로 완성하세요.',
  hint: 'ALB($16)·NAT($32)·EC2는 함정입니다. 사용량 과금(서버리스) 블록만으로 조립하면 $1~2에 끝납니다.',
  requiredResources: ['apigw', 'lambda', 'dynamodb'],
  budget: BUDGET,
  steps: [
    {
      text: 'API Gateway → Lambda → DynamoDB(또는 S3) 체인을 완성하세요.',
      done: (ctx) => liveChain(ctx, CHAIN) !== null,
    },
    {
      text: `오류 없이 월 $${BUDGET} 이내를 지키세요 (좌상단 💸 미터 확인).`,
      done: (ctx) => ctx.allValid && estimateMonthlyCost(ctx.nodes) <= BUDGET,
    },
    {
      text: '보안 경고(🛡)까지 0개로 만드세요.',
      done: (ctx) => ctx.securityOk,
    },
  ],
  // ★1 체인 동작 · ★2 예산 내 + 오류 0 · ★3 +보안 경고 0.
  // 순차 게이트: 예산(미션의 본질)을 지키지 못하면 보안 별도 없다.
  check: (ctx) => {
    if (!liveChain(ctx, CHAIN)) return 0
    if (!(ctx.allValid && estimateMonthlyCost(ctx.nodes) <= BUDGET)) return 1
    return ctx.securityOk ? 3 : 2
  },
}
