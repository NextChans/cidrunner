import type { Mission } from './types'

export const serverless: Mission = {
  id: 'serverless',
  title: '서버리스 API',
  description:
    '서버 없이 갑니다. API Gateway를 Lambda 함수에 연결하고 데이터를 S3에 저장하세요 — VPC 불필요.',
  goal: '클라이언트 → API Gateway → Lambda → S3 로 연결하세요.',
  hint: 'Lambda 블록에는 API Gateway가 포함되어 있습니다. 곧바로 스토리지에 연결하세요.',
  requiredResources: ['lambda', 's3'],
  // ★1 Lambda→저장소 트래픽 도달 · ★2 설정 오류 없음 · ★3 S3에 연결
  check: ({ nodes, sim, allValid }) => {
    const typeOf = (id: string) => nodes.find((n) => n.id === id)?.data.type
    const path = sim.pathNodeIds.map(typeOf)
    const ok =
      sim.ok && path[0] === 'lambda' && (path.includes('s3') || path.includes('rds'))
    if (!ok) return 0
    let stars = 1
    if (allValid) stars += 1
    if (path.includes('s3')) stars += 1
    return stars
  },
}
