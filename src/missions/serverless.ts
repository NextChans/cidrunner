import type { Mission } from './types'
import { liveChain } from './scope'

export const serverless: Mission = {
  id: 'serverless',
  title: '서버리스 API',
  description:
    '서버 없이 갑니다. API Gateway를 Lambda 함수에 연결하고 데이터를 S3에 저장하세요 — VPC 불필요.',
  goal: 'API Gateway → Lambda → S3 로 요청이 도달하게 하세요.',
  hint: 'API Gateway가 진입점입니다(클라이언트는 별도 블록이 아닙니다). API Gateway → Lambda → S3 순으로 엣지를 이으세요. S3 버저닝까지 켜면 별 3개!',
  // API Gateway is now its own block (ADR 0046) rather than bundled into Lambda,
  // so a correct solution fronts the function with an explicit API Gateway.
  requiredResources: ['apigw', 'lambda', 's3'],
  // ★1 API GW→Lambda→저장소 도달 · ★2 설정 오류 없음 · ★3 S3 + 버저닝(백업 베스트 프랙티스)
  check: (ctx) => {
    // API Gateway → Lambda → storage, matched structurally over live edges. Prefer
    // an S3 sink (its versioning earns ★3); fall back to RDS for the reach star.
    const s3Chain = liveChain(ctx, ['apigw', 'lambda', 's3'])
    const chain = s3Chain ?? liveChain(ctx, ['apigw', 'lambda', 'rds'])
    if (!chain) return 0
    let stars = 1
    if (ctx.allValid) stars += 1
    if (s3Chain) {
      const s3 = ctx.nodes.find((n) => n.id === s3Chain[s3Chain.length - 1])
      if (s3?.data.config.versioning === true) stars += 1
    }
    return stars
  },
}
