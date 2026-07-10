import type { Mission } from './types'
import { liveChain } from './scope'
import { assignedSgIds } from '@/graph/securityGroups'

export const threeTier: Mission = {
  id: 'three-tier',
  title: '고가용성 3-tier 웹',
  description:
    '업계 표준 웹 계층을 구성합니다: 서로 다른 AZ의 퍼블릭 Subnet 2개에 걸친 ALB가 EC2로 트래픽을 보내고, 뒤에는 프라이빗 Subnet의 RDS가 있습니다.',
  goal: '클라이언트 → ALB → EC2 → RDS 로 트래픽이 DB까지 도달하게 하세요 (AZ 2개).',
  hint: 'Subnet의 AZ를 서로 다르게 설정하세요. ALB·RDS는 2개 AZ가 필요합니다. 인스펙터에서 각 계층에 Security Group을 지정하면 별 3개!',
  requiredResources: ['vpc', 'subnet', 'igw', 'alb', 'ec2', 'rds'],
  budget: 60,
  // ★1 ALB→EC2→RDS 트래픽 도달 · ★2 오류 없음(멀티 AZ 포함) · ★3 3계층 모두 SG 지정
  check: (ctx) => {
    const { nodes, securityGroups, allValid } = ctx
    // ALB → EC2 → RDS as a live chain (works whether the ALB is the entry or is
    // fed by CloudFront, and regardless of other ALB fan-out branches).
    if (!liveChain(ctx, ['alb', 'ec2', 'rds'])) return 0
    let stars = 1
    if (allValid) stars += 1
    // Every ALB/EC2/RDS wears at least one Security Group (ADR 0059).
    const sgAssigned = (t: string) =>
      nodes.filter((n) => n.data.type === t).every((n) => assignedSgIds(n).length > 0)
    if (securityGroups.length > 0 && sgAssigned('alb') && sgAssigned('ec2') && sgAssigned('rds')) {
      stars += 1
    }
    return stars
  },
}
