import type { Mission } from './types'
import { liveChain, scopedSecurityOk } from './scope'

export const secureAuthWeb: Mission = {
  id: 'secure-auth-web',
  title: '보안·인증 웹',
  description:
    '프로덕션급 인증 웹 서비스를 구성합니다: CloudFront → ALB → EC2 → RDS 트래픽 경로 위에 Cognito(인증), Secrets Manager(DB 자격증명), ACM(TLS), WAF(L7 방어)를 갖춥니다.',
  goal: 'CloudFront → ALB → EC2 → RDS 경로에 Cognito·Secrets Manager·ACM·WAF를 모두 배치하세요.',
  hint: 'CloudFront 오리진을 외부 ALB로 두고, ALB 뒤 EC2, 그 뒤 RDS로 연결합니다. Cognito·Secrets Manager·ACM·WAF 블록을 캔버스에 추가하세요. 보안 경고가 0이면 별 3개!',
  requiredResources: ['cloudfront', 'alb', 'ec2', 'rds', 'cognito', 'secretsmanager', 'acm', 'waf'],
  budget: 60,
  // ★1 CF→ALB→EC2→RDS 도달 + 보안 스택(Cognito/Secrets/ACM/WAF) 존재
  // ★2 설정 오류 없음 · ★3 보안 경고 0
  check: (ctx) => {
    const { nodes, allValid } = ctx
    const has = (t: string) => nodes.some((n) => n.data.type === t)
    const chain = liveChain(ctx, ['cloudfront', 'alb', 'ec2', 'rds'])
    if (!chain) return 0
    if (!has('cognito') || !has('secretsmanager') || !has('acm') || !has('waf')) return 0
    let stars = 1
    if (allValid) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
