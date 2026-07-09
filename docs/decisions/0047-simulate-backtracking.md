# 0047. 시뮬레이션 백트래킹 — greedy 단일 경로 → DFS 다중 경로 탐색 (QA-002)

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0012](0012-traffic-simulation-model.md), [0018](0018-multi-flow-playback-and-palette-categories.md), [0039](0039-igw-internet-ingress-simulation.md)

## Context

QA 리포트 [QA-002 (Major)](../qa/2026-07-09-qa-report.md): greedy 단일 경로 트레이서가 분기 진입점에서 미션 클리어를 **오탐**한다.

기존 `traceFlow`([simulate.ts](../../src/graph/simulate.ts))는 각 노드에서 `for (const edge of trafficEdges) { … break }`로 **첫 매치 아웃고잉 엣지만 확정**하고 백트래킹하지 않았다. 진입점당 1 flow, 1 path. 재현:

1. ALB → EC2-A (DB 미연결, 막다른 길) 엣지를 **먼저** 그림.
2. ALB → EC2-B → RDS (유효한 완결 경로)를 나중에 그림.
3. 시뮬 → 트레이서가 EC2-A를 골라 `ok=false`, `three-tier`/`container-workload` 미션 미클리어.

HA로 앱 서버 2대를 두고 한쪽 DB 엣지만 완성한 정답 토폴로지가 "올바른 경로가 있는데도" 오탐되는, mission grading 신뢰도 문제. (최소 정답인 선형 체인은 영향 없음 — 분기가 없으면 어느 엣지든 sink 도달.) ADR 0012/0018의 의도된 단순화였으나 분기 진입점 영향이 문서화되지 않았다. QA 리포트는 F3 시뮬 리팩터에 흡수를 권고했다.

## Decision

`traceFlow`를 **깊이 우선 탐색(DFS) + 백트래킹**으로 재작성한다. 판정 기준: **"sink에 도달하는 경로가 하나라도 있으면 그 flow는 성공."**

- **탐색** — 진입점에서 아웃고잉 트래픽 엣지를 그래프 순서대로 재귀 시도. 첫 sink 도달 경로가 승리(결정적). 콜스택으로 `nodePath`/`edgePath`를 관리해 sink 히트 시 유효한 단순 경로를 스냅샷.
- **순환 방지 & 복잡도** — 노드별 `visited` 집합을 **되돌리지 않는** 도달성 탐색. "이 노드에서 sink에 갈 수 있는가"는 도착 경로와 무관하므로 노드는 1회만 확장 → **O(V+E)**, 사이클에서 자연 종료. (한 노드가 sink에 도달 가능하면 처음 방문 시 발견되므로, 재방문 스킵이 유효 경로를 놓치지 않는다.)
- **실패 표현** — sink 미도달 시 **가장 깊이 도달한 경로**(bestFail, `nodePath` 최장)를 노출해 block 메시지가 의미 있는 막다른 노드를 가리키게 함(기존 힌트 UX 보존). 실패 flow의 `pathEdgeIds`도 함께 유지.
- **인그레스 게이트 통합(ADR 0039)** — 노드 진입 시 `internetIngressBlock`을 먼저 평가. IGW/퍼블릭 subnet 없는 external ALB는 어떤 경로로도 통과 불가하므로 그 지점에서 해당 브랜치 실패.
- **하이라이트 = 전체 라이브 서브그래프** — per-flow `traceFlow`는 진입점당 **대표 경로 1개**만 반환하고(banner·미션 판정 입력), **하이라이트는 별도로** 계산한다. `SimResult`의 `pathNodeIds`/`edgeHops`/`edgeStatus`/`arrivals`는 "모든 유효 entry→sink 경로"의 합집합 — entry에서 forward 도달 가능하고(인그레스 차단 ALB는 벽으로 미확장) 동시에 sink로 backward 도달 가능한 엣지/노드를 green으로 켠다. **근거**: fan-out(ADR 0048)이 ALB→여러 타깃을 분산해 보여주는데 다운스트림은 DFS가 고른 한 경로만 켜지면(예: `ALB→EC2-A→RDS`만 green, `ALB→EC2-B→RDS`는 회색) 시각적 모순이 된다. 로드 밸런싱 되는 모든 타깃의 sink 경로가 함께 켜져야 일관적이다. sink에 도달 못 하는 fan-out 타깃(막다른 EC2)은 그 엣지를 blocked(red), 타깃 노드를 red dead-end로 표시. (초기 F3 구현은 flow당 1경로만 하이라이트해 리뷰에서 이 모순이 지적됨 — 같은 스프린트 내 후속 수정.)

## 테스트 재설계

기존 `simulate-edge.test.ts`는 greedy 동작(`follows the first outgoing edge`)을 **의도 동작으로 락인**하고 있었다(ADR 0044에서도 "테스트로 락인된 의도 동작이라 미변경"으로 기록). 백트래킹 의미로 **재설계**:

- 삭제/재해석: "첫 아웃고잉 엣지 확정" → "이미 순서가 맞으면 첫 sink에서 단축(short-circuit)".
- 신규: **QA-002 회귀 락인** — dead 브랜치를 먼저 그려도 완결 sibling 경로를 찾음(`alb → ec2b → rds`).
- 신규: 모든 브랜치가 막다른 길일 때만 실패.
- 유지: 사이클 종료(가장 깊은 dead end에서 block), SG-only 인바운드가 진입점 자격 유지, blocked id 집계.

기존 `simulate.test.ts`·`simulate-ingress.test.ts`는 DFS-first-success/deepest-fail 규칙으로 **출력 동일**해 무변경 통과(3-tier 경로·인그레스 게이트·arrival stagger 모두 보존).

## Consequences

- **미션 판정 복원** — false-negative 제거. MissionPanel은 sim 결과를 그대로 소비([MissionPanel.tsx](../../src/components/MissionPanel.tsx))하므로 체커 로직 무변경으로 분기 정답이 열림.
- **결정성 유지** — 엣지 그래프 순서가 탐색 순서 = 하이라이트 순서. 재현 가능.
- **성능** — O(V+E), 100 노드에서도 즉시. 되돌리지 않는 visited로 지수 폭발 방지.
- **시각화 연동** — 실패 flow도 `pathEdgeIds`를 반환해 엣지 in/out red 효과(ADR 0049)가 막힌 엣지를 표시.
- **회귀 없음** — 159개 테스트 green(백트래킹·viz 신규 포함), 12개 미션 fixture 3★ 유지.
