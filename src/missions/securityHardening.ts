import type { Mission } from './types'

export const securityHardening: Mission = {
  id: 'security-hardening',
  title: '🔒 시큐리티 하드닝',
  description:
    '동작하는 3-tier를 보안 베스트 프랙티스로 잠급니다: DB는 프라이빗 Subnet에 격리, 저장 데이터 암호화, SSH 미개방, 모든 계층에 Security Group.',
  goal: '3-tier 트래픽이 흐르는 상태에서 보안 경고를 전부 제거하세요.',
  hint: 'RDS를 프라이빗 Subnet(퍼블릭 해제)으로 옮기고 스토리지 암호화를 켜세요. SG의 SSH를 끄고, ⚠️ 표시가 남은 리소스에 SG를 연결하세요.',
  requiredResources: ['vpc', 'subnet', 'igw', 'alb', 'ec2', 'rds', 'sg'],
  // ★1 3-tier 도달 + DB가 프라이빗 · ★2 + SSH 미개방·DB 암호화 · ★3 + 보안 경고 0
  check: ({ nodes, sim, securityOk }) => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const typeOf = (id: string) => byId.get(id)?.data.type
    const reachesDb = sim.flows.some((f) => {
      const path = f.pathNodeIds.map(typeOf)
      return f.ok && path.includes('alb') && path.includes('ec2') && path.includes('rds')
    })
    if (!reachesDb) return 0

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
    if (securityOk) stars += 1
    return stars
  },
}
