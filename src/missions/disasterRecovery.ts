import type { Mission } from './types'

export const disasterRecovery: Mission = {
  id: 'disaster-recovery',
  title: '재난 복구 (Multi-AZ)',
  description:
    'AZ 장애에 대비합니다: 기본 RDS를 Multi-AZ로 배포하고, 다른 AZ의 프라이빗 Subnet에 읽기 복제본을 두어 복구 태세를 갖춥니다.',
  goal: '기본 RDS(Multi-AZ) + 다른 AZ의 읽기 복제본을 구성하세요.',
  hint: 'RDS 2개를 서로 다른 AZ의 Subnet에 놓고, 기본 → 복제본으로 엣지를 그으면 읽기 복제본이 됩니다(같은 엔진). 기본 RDS의 Multi-AZ를 켜세요.',
  requiredResources: ['vpc', 'subnet', 'rds'],
  // ★1 기본+복제본 존재 · ★2 기본 Multi-AZ · ★3 복제본이 다른 AZ + 설정 오류 없음
  check: ({ nodes, edges, allValid }) => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const replEdge = edges.find(
      (e) =>
        byId.get(e.source)?.data.type === 'rds' && byId.get(e.target)?.data.type === 'rds',
    )
    if (!replEdge) return 0
    const primary = byId.get(replEdge.source)
    const replica = byId.get(replEdge.target)
    if (!primary || !replica) return 0

    let stars = 1
    if (primary.data.config.multi_az === true) stars += 1

    const azOf = (n: (typeof nodes)[number]) => {
      const parent = n.parentId ? byId.get(n.parentId) : undefined
      return parent?.data.type === 'subnet' ? String(parent.data.config.az ?? 'a') : null
    }
    const primaryAz = azOf(primary)
    const replicaAz = azOf(replica)
    if (primaryAz !== null && replicaAz !== null && primaryAz !== replicaAz && allValid) {
      stars += 1
    }
    return stars
  },
}
