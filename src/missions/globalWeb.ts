import type { Mission } from './types'
import { liveChain, scopedSecurityOk } from './scope'

export const globalWeb: Mission = {
  id: 'global-web',
  title: '글로벌 동적 웹',
  description:
    '정적 사이트가 아닌 동적 애플리케이션을 전 세계에 배포합니다: Route 53 도메인이 CloudFront를 가리키고, CloudFront가 ALB를 오리진으로 삼아 뒤의 EC2·RDS까지 요청을 전달합니다.',
  goal: 'Route 53 → CloudFront → ALB → EC2 → RDS 로 요청이 도달하게 하세요.',
  hint: 'CloudFront의 오리진을 S3가 아니라 ALB로 두세요(외부 ALB여야 합니다). ALB 뒤에 EC2, 그 뒤에 RDS를 연결합니다. 보안 경고가 0이면 별 3개!',
  requiredResources: ['route53', 'cloudfront', 'alb', 'ec2', 'rds'],
  // ★1 R53→CF→ALB→EC2→RDS 도달 · ★2 설정 오류 없음 · ★3 보안 경고 0
  check: (ctx) => {
    const chain = liveChain(ctx, ['route53', 'cloudfront', 'alb', 'ec2', 'rds'])
    if (!chain) return 0
    let stars = 1
    if (ctx.allValid) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
