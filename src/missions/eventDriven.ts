import type { Mission } from './types'
import { liveChain, scopedSecurityOk } from './scope'

export const eventDriven: Mission = {
  id: 'event-driven',
  title: '이벤트 드리븐 팬아웃',
  description:
    'SNS 토픽으로 이벤트를 팬아웃합니다: 생산자 Lambda가 SNS에 발행하고, SNS가 SQS로 전달, 컨슈머 Lambda가 큐에서 꺼내 DynamoDB에 저장합니다.',
  goal: 'Lambda → SNS → SQS → Lambda → DynamoDB 로 이벤트가 저장되게 하세요.',
  hint: 'Lambda 블록이 2개 필요합니다 — 생산자는 SNS에 발행하고, 컨슈머는 SQS를 소비합니다. SNS → SQS 엣지로 팬아웃을 구성하세요. (생산자 앞에 API Gateway를 둬도 됩니다.)',
  requiredResources: ['lambda', 'sns', 'sqs', 'dynamodb'],
  // ★1 Lambda→SNS→SQS→Lambda→DynamoDB 도달 · ★2 설정 오류 없음 · ★3 보안 경고 0
  check: (ctx) => {
    const chain = liveChain(ctx, ['lambda', 'sns', 'sqs', 'lambda', 'dynamodb'])
    if (!chain) return 0
    let stars = 1
    if (ctx.allValid) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
