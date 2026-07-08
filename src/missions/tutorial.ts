import type { Mission } from './types'

export const tutorial: Mission = {
  id: 'tutorial',
  title: '첫 VPC 만들기',
  description:
    '캔버스에 VPC를 놓고 그 안에 퍼블릭 Subnet을 만들어 보세요. 블록이 어떻게 중첩되는지 배웁니다.',
  goal: 'VPC 1개 안에 퍼블릭 Subnet 1개를 배치하세요.',
  hint: 'Subnet은 VPC 안에 있어야 CIDR 범위를 할당받습니다. IGW까지 붙이면 별 3개!',
  requiredResources: ['vpc', 'subnet'],
  // ★1 VPC에 퍼블릭 Subnet · ★2 설정 오류 없음 · ★3 IGW로 인터넷 연결
  check: ({ nodes, allValid }) => {
    const vpc = nodes.find((n) => n.data.type === 'vpc')
    if (!vpc) return 0
    const hasPublicSubnet = nodes.some(
      (n) =>
        n.data.type === 'subnet' &&
        n.parentId === vpc.id &&
        n.data.config.public === true,
    )
    if (!hasPublicSubnet) return 0
    let stars = 1
    if (allValid) stars += 1
    if (nodes.some((n) => n.data.type === 'igw' && n.parentId === vpc.id)) stars += 1
    return stars
  },
}
