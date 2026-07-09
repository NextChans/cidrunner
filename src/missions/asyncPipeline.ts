import type { Edge } from '@xyflow/react'
import type { Mission, MissionCheckContext } from './types'
import { scopedSecurityOk } from './scope'

/**
 * Finds a live chain of edge *types* over the simulation's `ok` edges — the
 * edges that lie on some reachable entry→sink path (ADR 0047/0049). Matching the
 * chain structurally (rather than inspecting a single traced flow) makes the
 * grade robust to forks (a producer Lambda that also writes S3) and to an
 * optional front (an API Gateway ahead of the producer Lambda — ADR 0046): the
 * pattern is graded wherever it lives, not only when it is the sole path.
 *
 * `pattern` is the type sequence to walk; returns the matched node ids (in
 * order) or `null`. Consecutive Lambdas must be distinct nodes so a
 * producer/consumer pair is never satisfied by one function looping on itself.
 */
export function liveChain(
  ctx: Pick<MissionCheckContext, 'nodes' | 'edges' | 'sim'>,
  pattern: readonly string[],
): string[] | null {
  const typeOf = (id: string) => ctx.nodes.find((n) => n.id === id)?.data.type
  const ok = new Set(ctx.sim.pathEdgeIds)
  const step = (from: string, dst: string): Edge[] =>
    ctx.edges.filter(
      (e) => ok.has(e.id) && e.source === from && typeOf(e.target) === dst,
    )

  const walk = (nodeId: string, i: number, acc: string[]): string[] | null => {
    if (i === pattern.length) return acc
    for (const e of step(nodeId, pattern[i]!)) {
      // Reject an immediate Lambda→…→Lambda hop that reuses the same function.
      if (pattern[i] === 'lambda' && acc.includes(e.target)) continue
      const found = walk(e.target, i + 1, [...acc, e.target])
      if (found) return found
    }
    return null
  }

  // Seed from every node whose type matches the first pattern element and which
  // originates a matching live edge.
  for (const n of ctx.nodes) {
    if (n.data.type !== pattern[0]) continue
    if (step(n.id, pattern[1]!).length === 0) continue
    const found = walk(n.id, 1, [n.id])
    if (found) return found
  }
  return null
}

export const asyncPipeline: Mission = {
  id: 'async-pipeline',
  title: '비동기 파이프라인',
  description:
    '요청을 큐로 받아 비동기로 처리합니다: API Lambda가 SQS에 넣고, 컨슈머 Lambda가 꺼내 DynamoDB에 저장합니다.',
  goal: 'Lambda → SQS → Lambda → DynamoDB 로 요청이 저장되게 하세요.',
  hint: 'Lambda 블록이 2개 필요합니다 — 하나는 생산자(API), 하나는 큐를 소비하는 워커입니다. (생산자 앞에 API Gateway를 둬도 됩니다.)',
  requiredResources: ['lambda', 'sqs', 'dynamodb'],
  // ★1 Lambda→SQS→Lambda→DynamoDB 도달 · ★2 설정 오류 없음 · ★3 보안 경고 0
  check: (ctx) => {
    const chain = liveChain(ctx, ['lambda', 'sqs', 'lambda', 'dynamodb'])
    if (!chain) return 0
    let stars = 1
    if (ctx.allValid) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
