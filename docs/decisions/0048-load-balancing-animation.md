# 0048. 로드 밸런싱 애니메이션 — ALB fan-out 시각화 규격

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0012](0012-traffic-simulation-model.md), [0018](0018-multi-flow-playback-and-palette-categories.md), [0047](0047-simulate-backtracking.md)

## Context

시뮬 시작 시 트래픽 파티클은 흐르지만 ALB가 여러 타깃으로 **부하를 분산**한다는 것이 시각적으로 드러나지 않았다. 백트래킹(ADR 0047) 도입으로 flow당 성공 경로 1개만 하이라이트되면, ALB가 EC2 2대에 등록돼 있어도 승리 경로 1개만 파티클이 흘러 "로드 밸런싱"으로 읽히지 않는다. 요구: Start 시 ALB에서 여러 target으로 라운드로빈처럼 분기되는 애니메이션.

## Decision

시뮬 결과에 **load-balancer fan-out 메타데이터**를 추가하고, 렌더러가 이를 라운드로빈 분산으로 애니메이션한다.

- **`SimResult.fanout`** — `Record<edgeId, { index, total }>`. 계산: 도달했고(`pathNodeIds`에 포함) 차단되지 않은(`blockedNodeIds`에 없음) **밸런서**(`BALANCERS = {alb}`)의 **모든** 아웃고잉 트래픽 엣지를 슬롯팅. 타깃이 **2개 이상일 때만** 슬롯(단일 타깃은 fan-out이 아님). 승리 경로 밖의 엣지(예: DB 미연결 dead 타깃)도 포함 — 실제 LB는 백엔드 경로와 무관하게 등록 타깃 전체에 분산하기 때문.
- **엣지 라운드로빈** — [TrafficEdge](../../src/components/edges/TrafficEdge.tsx)에서 fan-out 엣지는 사이클(`1.4s`) 내 begin 오프셋을 `(index/total)*cycle`로 부여. sibling 엣지들이 시간차로 순차 발사돼 라운드로빈으로 읽힘. 경로 위 일반 엣지는 hop 오프셋(`hop*HOP_SECONDS`) 유지.
- **ALB 노드 pulse** — [ResourceNode](../../src/components/nodes/ResourceNode.tsx)에서 활성(`onPath`) ALB에 연속 바이올렛 링 애니메이션(`.lb-pulse`, [index.css](../../src/index.css))을 오버레이해 "분산 중" 활성 상태를 표시. 기존 emerald `sim-arrival` pulse와 색으로 구별.

## Consequences

- **부하 분산 인지** — ALB가 등록된 모든 타깃으로 시간차 파티클을 발사하고 노드가 맥동해, 승리 경로가 1개여도 로드 밸런싱이 시각적으로 명확.
- **백트래킹과 정합** — dead-end 타깃(ADR 0047의 EC2-A)도 fan-out에 포함돼 "LB는 분산하지만 그 경로는 완결 안 됨"이 노드 색(막힌 노드 red)으로 구분됨.
- **성능** — 활성 밸런서의 엣지에만 적용, sim은 보통 소수 엣지만 하이라이트. SVG `animateMotion`/CSS keyframe으로 GPU 친화적. 100 노드에서도 부드러움.
- **확장 가능** — `BALANCERS` 집합으로 향후 다른 분산 리소스 추가 용이.
- **테스트** — fan-out 슬롯팅(다중 타깃 index/total, 단일 타깃 미적용)을 `simulate-edge.test.ts`에 락인.
