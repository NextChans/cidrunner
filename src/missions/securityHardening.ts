import type { Mission } from './types'
import { liveChain, scopedSecurityOk } from './scope'

export const securityHardening: Mission = {
  id: 'security-hardening',
  title: '🔒 시큐리티 하드닝',
  description:
    '동작하는 3-tier를 보안 베스트 프랙티스로 잠급니다: DB는 프라이빗 Subnet에 격리, 저장 데이터 암호화, SSH 미개방, 모든 계층에 Security Group.',
  goal: '3-tier 트래픽이 흐르는 상태에서 보안 경고를 전부 제거하세요.',
  hint: 'RDS를 프라이빗 Subnet(퍼블릭 해제)으로 옮기고 스토리지 암호화를 켜세요. SG의 SSH를 끄고, ⚠️ 표시가 남은 리소스에 SG를 연결하세요.',
  requiredResources: ['vpc', 'subnet', 'igw', 'alb', 'ec2', 'rds', 'sg'],
  // ★1 3-tier 도달 + DB가 프라이빗 · ★2 + SSH 미개방·DB 암호화 · ★3 + 보안 경고 0
  check: (ctx) => {
    const { nodes } = ctx
    const byId = new Map(nodes.map((n) => [n.id, n]))
    // ALB → EC2 → RDS as a live chain — matched structurally so a load balancer
    // that also fans out to a container/other branch doesn't hide the EC2 path
    // (same fix as the sibling 3-tier missions — ADR 0047/0041 lineage).
    const chain = liveChain(ctx, ['alb', 'ec2', 'rds'])
    if (!chain) return 0

    const rdsNodes = nodes.filter((n) => n.data.type === 'rds')
    const dbPrivate =
      rdsNodes.length > 0 &&
      rdsNodes.every((n) => {
        const parent = n.parentId ? byId.get(n.parentId) : undefined
        return parent?.data.type === 'subnet' && parent.data.config.public !== true
      })
    if (!dbPrivate) return 0

    let stars = 1
    const noSsh = nodes
      .filter((n) => n.data.type === 'sg')
      .every((n) => n.data.config.allow_ssh !== true)
    const dbEncrypted = rdsNodes.every((n) => n.data.config.storage_encrypted !== false)
    if (noSsh && dbEncrypted) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
