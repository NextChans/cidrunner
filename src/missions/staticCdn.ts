import type { Mission } from './types'
import { scopedSecurityOk } from './scope'

export const staticCdn: Mission = {
  id: 'static-cdn',
  title: '글로벌 정적 웹',
  description:
    '정적 사이트 배포의 표준 패턴: Route 53 도메인이 CloudFront를 가리키고, CloudFront가 비공개 S3 버킷을 오리진으로 서빙합니다.',
  goal: 'Route 53 → CloudFront → S3 로 요청이 도달하게 하세요.',
  hint: 'S3의 퍼블릭 액세스 차단은 켠 채로 두세요 — CloudFront(OAI)가 대신 읽습니다. 그게 이 패턴의 핵심입니다.',
  requiredResources: ['route53', 'cloudfront', 's3'],
  // ★1 R53→CF→S3 도달 · ★2 설정 오류 없음 · ★3 이 미션 빌드의 보안 경고 0
  //  (비공개 버킷 유지 — ADR 0041: ★3은 그래프 전체가 아니라 이 미션의 연결된
  //   빌드만 평가하므로, 손대지 않은 시드 그래프가 ★3을 막지 않습니다.)
  check: (ctx) => {
    const { nodes, sim, allValid } = ctx
    const typeOf = (id: string) => nodes.find((n) => n.id === id)?.data.type
    const flow = sim.flows.find((f) => {
      const path = f.pathNodeIds.map(typeOf)
      return (
        f.ok &&
        path[0] === 'route53' &&
        path.includes('cloudfront') &&
        path[path.length - 1] === 's3'
      )
    })
    if (!flow) return 0
    let stars = 1
    if (allValid) stars += 1
    if (scopedSecurityOk(ctx, flow.pathNodeIds)) stars += 1
    return stars
  },
}
