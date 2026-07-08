import type { Mission } from './types'

export const threeTier: Mission = {
  id: 'three-tier',
  title: '고가용성 3-tier 웹',
  description:
    '업계 표준 웹 계층을 구성합니다: 서로 다른 AZ의 퍼블릭 Subnet 2개에 걸친 ALB가 EC2로 트래픽을 보내고, 뒤에는 프라이빗 Subnet의 RDS가 있습니다.',
  goal: '클라이언트 → ALB → EC2 → RDS 로 트래픽이 DB까지 도달하게 하세요 (AZ 2개).',
  hint: 'Subnet의 AZ를 서로 다르게 설정하세요. ALB·RDS는 2개 AZ가 필요합니다. Security Group을 각 계층에 연결하면 별 3개!',
  requiredResources: ['vpc', 'subnet', 'igw', 'alb', 'ec2', 'rds', 'sg'],
  // ★1 ALB→EC2→RDS 트래픽 도달 · ★2 오류 없음(멀티 AZ 포함) · ★3 3계층 모두 SG 연결
  check: ({ nodes, edges, sim, allValid }) => {
    const typeOf = (id: string) => nodes.find((n) => n.id === id)?.data.type
    const reachesDb = sim.flows.some((f) => {
      const path = f.pathNodeIds.map(typeOf)
      return f.ok && path.includes('alb') && path.includes('ec2') && path.includes('rds')
    })
    if (!reachesDb) return 0
    let stars = 1
    if (allValid) stars += 1
    const sgAttached = (t: string) =>
      nodes
        .filter((n) => n.data.type === t)
        .every((n) =>
          edges.some(
            (e) => e.target === n.id && typeOf(e.source) === 'sg',
          ),
        )
    if (
      nodes.some((n) => n.data.type === 'sg') &&
      sgAttached('alb') &&
      sgAttached('ec2') &&
      sgAttached('rds')
    ) {
      stars += 1
    }
    return stars
  },
}
