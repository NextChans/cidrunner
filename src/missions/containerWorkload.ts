import type { Mission } from './types'
import { liveChain, scopedSecurityOk } from './scope'

export const containerWorkload: Mission = {
  id: 'container-workload',
  title: '컨테이너 워크로드',
  description:
    'Lambda보다 무거운 워크로드를 컨테이너로 운영합니다: ALB가 트래픽을 ECS(또는 EKS) 컨테이너로 보내고, 컨테이너는 뒤의 RDS에 접근합니다.',
  goal: 'ALB → 컨테이너(ECS/EKS) → RDS 로 트래픽이 DB까지 도달하게 하세요.',
  hint: 'ECS Fargate 또는 EKS를 VPC에 놓고, ALB에서 컨테이너로 엣지를 그으세요. ALB·컨테이너·RDS 모두에 Security Group을 연결하면 별 3개!',
  requiredResources: ['vpc', 'subnet', 'alb', 'ecs', 'rds'],
  budget: 60,
  // ★1 ALB→컨테이너→RDS 도달 · ★2 설정 오류 없음(멀티 AZ 포함) · ★3 보안 경고 0
  check: (ctx) => {
    // ALB → container(ECS/EKS) → RDS, matched structurally over live edges so a
    // load balancer that also fans out to EC2 doesn't hide the container branch.
    const chain = liveChain(ctx, ['alb', ['ecs', 'eks'], 'rds'])
    if (!chain) return 0
    let stars = 1
    if (ctx.allValid) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
