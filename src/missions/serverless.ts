import type { Mission } from './types'

export const serverless: Mission = {
  id: 'serverless',
  title: '서버리스 API',
  description:
    '서버 없이 갑니다. API Gateway를 Lambda 함수에 연결하고 데이터를 S3에 저장하세요 — VPC 불필요.',
  goal: '클라이언트 → API Gateway → Lambda → S3 로 연결하세요.',
  hint: 'Lambda 블록에는 API Gateway가 포함되어 있습니다. S3 버저닝까지 켜면 별 3개!',
  requiredResources: ['lambda', 's3'],
  // ★1 Lambda→저장소 도달 · ★2 설정 오류 없음 · ★3 S3 + 버저닝(백업 베스트 프랙티스)
  check: ({ nodes, sim, allValid }) => {
    const typeOf = (id: string) => nodes.find((n) => n.id === id)?.data.type
    const flow = sim.flows.find((f) => {
      const path = f.pathNodeIds.map(typeOf)
      return f.ok && path[0] === 'lambda' && (path.includes('s3') || path.includes('rds'))
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
