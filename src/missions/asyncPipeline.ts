import type { Mission } from './types'
import { liveChain, scopedSecurityOk } from './scope'

export const asyncPipeline: Mission = {
  id: 'async-pipeline',
  title: '비동기 파이프라인',
  description:
    '요청을 큐로 받아 비동기로 처리합니다: API Lambda가 SQS에 넣고, 컨슈머 Lambda가 꺼내 DynamoDB에 저장합니다.',
  goal: 'Lambda → SQS → Lambda → DynamoDB 로 요청이 저장되게 하세요.',
  hint: 'Lambda 블록이 2개 필요합니다 — 하나는 생산자(API), 하나는 큐를 소비하는 워커입니다. (생산자 앞에 API Gateway를 둬도 됩니다.)',
  requiredResources: ['lambda', 'sqs', 'dynamodb'],
  // ★1 Lambda→SQS→Lambda→DynamoDB 도달 · ★2 설정 오류 없음 · ★3 보안 경고 0
  check: (ctx) => {
    const chain = liveChain(ctx, ['lambda', 'sqs', 'lambda', 'dynamodb'])
    if (!chain) return 0
    let stars = 1
    if (ctx.allValid) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
