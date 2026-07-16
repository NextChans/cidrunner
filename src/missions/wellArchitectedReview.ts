import type { Mission, MissionCheckContext } from './types'
import { wellArchitectedGrade, type Grade } from '@/graph/grade'

/**
 * Ops-challenge capstone (ADR 0067): the mission whose STARS consume the
 * Well-Architected grade (ADR 0054), which was display-only until now. The
 * player raises the same live A–S badge the canvas shows — a working design
 * reaching B clears it, A earns ★2, and a fully-rounded S earns ★3. Because the
 * grade synthesizes all four pillars (security · reliability · cost ·
 * performance), acing three while neglecting one is not enough for the top star.
 */

const RANK: Record<Grade['letter'], number> = { D: 0, C: 1, B: 2, A: 3, S: 4 }

const gradeOf = (ctx: MissionCheckContext): Grade =>
  wellArchitectedGrade(ctx.nodes, ctx.edges, ctx.securityGroups)

export const wellArchitectedReview: Mission = {
  id: 'well-architected-review',
  title: '🏛️ Well-Architected 심사',
  description:
    '운영 챌린지 캡스톤: 보안·신뢰성·비용·성능 네 기둥을 종합한 Well-Architected 등급을 끌어올립니다. 한 축만 잘해서는 최고 등급을 받을 수 없습니다.',
  goal: '동작하는 설계로 A 등급(별 2개), 네 기둥을 고루 갖춘 S 등급이면 별 3개!',
  hint: '캔버스 좌상단 등급 배지를 보며 올리세요. 신뢰성=2개 AZ + Multi-AZ RDS(모든 단일 AZ 장애 생존), 성능=CloudFront/ElastiCache/읽기 복제본, 보안=경고 0, 비용=놀고 있는 값비싼 리소스 없기.',
  requiredResources: ['vpc', 'subnet', 'alb', 'ec2', 'rds', 'cloudfront', 'elasticache'],
  steps: [
    {
      text: '트래픽이 흐르는 설계를 완성하세요 (등급 B 이상).',
      done: (ctx) => ctx.sim.ok && RANK[gradeOf(ctx).letter] >= RANK.B,
    },
    {
      text: '신뢰성·성능을 끌어올려 종합 A 등급에 도달하세요.',
      done: (ctx) => RANK[gradeOf(ctx).letter] >= RANK.A,
    },
    {
      text: '네 기둥을 고루 채워 S 등급(종합 90점)을 달성하세요.',
      done: (ctx) => gradeOf(ctx).letter === 'S',
    },
  ],
  // ★1 동작 + B · ★2 A · ★3 S. 등급 배지(ADR 0054)와 1:1로 정렬된 순차 게이트.
  check: (ctx) => {
    if (!ctx.sim.ok) return 0
    const r = RANK[gradeOf(ctx).letter]
    if (r < RANK.B) return 0
    if (r < RANK.A) return 1
    if (r < RANK.S) return 2
    return 3
  },
}
