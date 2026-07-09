import type { Mission } from './types'

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
  check: ({ nodes, sim, allValid }) => {
    const typeOf = (id: string) => nodes.find((n) => n.id === id)?.data.type
    const flow = sim.flows.find((f) => {
      const path = f.pathNodeIds.map(typeOf)
      return (
        f.ok &&
        path[0] === 'apigw' &&
        path.includes('lambda') &&
        (path.includes('s3') || path.includes('rds'))
      )
    })
    if (!flow) return 0
    let stars = 1
    if (allValid) stars += 1
    const s3OnPath = flow.pathNodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .find((n) => n?.data.type === 's3')
    if (s3OnPath && s3OnPath.data.config.versioning === true) stars += 1
    return stars
  },
}
