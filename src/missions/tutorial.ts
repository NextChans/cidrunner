import type { Mission, MissionCheckContext } from './types'

/**
 * Is there a public Subnet inside a VPC? (shared by check + steps). Walks the
 * parent chain to the enclosing VPC, so a Subnet nested inside an AZ box
 * (Subnet ▸ AZ ▸ VPC — ADR 0050) still counts, not only a direct VPC child.
 */
function hasPublicSubnetInVpc(nodes: MissionCheckContext['nodes']): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const enclosingVpc = (start: (typeof nodes)[number]): boolean => {
    let cur = start.parentId ? byId.get(start.parentId) : undefined
    while (cur) {
      if (cur.data.type === 'vpc') return true
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return false
  }
  return nodes.some(
    (n) => n.data.type === 'subnet' && n.data.config.public === true && enclosingVpc(n),
  )
}

export const tutorial: Mission = {
  id: 'tutorial',
  title: '첫 VPC 만들기',
  description:
    '캔버스에 VPC를 놓고 그 안에 퍼블릭 Subnet을 만들어 보세요. 블록이 어떻게 중첩되는지 배웁니다.',
  goal: 'VPC 1개 안에 퍼블릭 Subnet 1개를 배치하세요.',
  hint: 'Subnet은 VPC 안에 있어야 CIDR 범위를 할당받습니다. IGW까지 붙이면 별 3개!',
  requiredResources: ['vpc', 'subnet'],
  // Interactive walkthrough (ADR 0030) — each step re-checks the live graph and
  // maps onto the same conditions the star `check` below uses.
  steps: [
    {
      text: '팔레트에서 VPC를 캔버스로 드래그해 놓으세요.',
      done: ({ nodes }) => nodes.some((n) => n.data.type === 'vpc'),
    },
    {
      text: 'VPC 안에 Subnet을 넣고, 인스펙터에서 "퍼블릭"을 켜세요.',
      done: ({ nodes }) => hasPublicSubnetInVpc(nodes),
    },
    {
      text: '빨간 오류 표시가 없도록 각 노드 설정을 채우세요.',
      done: ({ allValid }) => allValid,
    },
    {
      text: '별 3개! VPC에 인터넷 게이트웨이(IGW)를 추가하세요.',
      done: ({ nodes }) =>
        nodes.some(
          (n) =>
            n.data.type === 'igw' &&
            n.parentId === nodes.find((v) => v.data.type === 'vpc')?.id,
        ),
    },
  ],
  // ★1 VPC에 퍼블릭 Subnet · ★2 설정 오류 없음 · ★3 IGW로 인터넷 연결
  check: ({ nodes, allValid }) => {
    const vpc = nodes.find((n) => n.data.type === 'vpc')
    if (!vpc) return 0
    if (!hasPublicSubnetInVpc(nodes)) return 0
    let stars = 1
    if (allValid) stars += 1
    if (nodes.some((n) => n.data.type === 'igw' && n.parentId === vpc.id)) stars += 1
    return stars
  },
}
