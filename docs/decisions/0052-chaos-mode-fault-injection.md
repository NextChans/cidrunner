# 0052. 카오스 모드 — AZ 장애 주입 (비용 ↔ 복원력 딜레마)

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0012](0012-traffic-simulation-model.md), [0047](0047-simulate-backtracking.md), [0050](0050-account-az-containers-and-inheritance.md), [0051](0051-cost-budget-mode.md)

## Context

비용 예산 모드(ADR 0051)를 넣었지만 "예산 단독은 얇다 — 대가·트레이드오프가 없어 아직 게임이 아니다"는 판단. 예산이 **다른 가치와 충돌**해야 재미가 나온다. 가장 강력한 상대 축은 **복원력(resilience)**이다: 멀티-AZ·RDS Multi-AZ·ALB 이중화는 지금 그냥 검증 체크박스라 **체감이 없다**. "왜 2배 비싼 Multi-AZ를 쓰나?"가 눈에 보여야 한다.

## Decision

**AZ 장애 주입(카오스 모드)**을 추가한다. "AZ-x 다운" 버튼으로 해당 존의 리소스를 죽이고 시뮬을 재실행 → 설계가 버티는지 눈으로 확인. 예산(싸게)과 카오스(안 죽게)가 만나 **비용 ↔ 복원력 딜레마**가 생긴다.

### 장애 모델 — `graph/chaos.ts`

- `nodeAz(node)` — 노드가 속한 AZ: 자신(Subnet/AZ 박스)의 `az`, 또는 상위 체인의 Subnet `az`. AZ 독립 리소스(여러 AZ에 걸친 ALB, S3/CloudFront 등 글로벌)는 `null`.
- `graphAzs(nodes)` — 그래프에 존재하는 AZ 목록(장애 버튼 소스).
- `deadNodesForAz(nodes, az)` — 해당 AZ에 고정된 노드 전부 사망. **단, Multi-AZ RDS(`multi_az: true`)는 다른 존 스탠바이로 페일오버해 생존** — 2배 값을 낸 보상. AZ 독립 리소스도 생존.

### 시뮬 통합 — `simulate(nodes, edges, { deadNodeIds })`

- 죽은 노드는 그래프에서 제거된 것으로 취급(진입점·홉·sink 불가, 인접 엣지 무효). 기존 백트래킹 도달성(ADR 0047)이 그대로 "생존/차단"을 판정 — 이중화 경로가 있으면 재라우팅되어 도달(생존), 단일 경로면 차단(다운). `SimResult.deadNodeIds`로 렌더러에 노출.

### UI

- **카오스 패널**([Canvas.tsx](../../src/components/Canvas.tsx), bottom-center): 그래프의 AZ별 토글 버튼 + `복구`. 클릭 시 `setChaos(az)`가 죽은 집합으로 시뮬 재실행.
- **죽은 노드**([ResourceNode.tsx](../../src/components/nodes/ResourceNode.tsx)): 흐리게(opacity+grayscale) + ⚡ 마커.
- 결과는 기존 시뮬 배너로: 전부 도달=생존🎉 / N개 차단=다운⛔.

## Consequences

- **진짜 게임 루프** — 단일-AZ 3-tier($37)는 AZ 다운 시 붕괴, 2-AZ + Multi-AZ RDS($58)는 생존. "**싸고·안 죽는** 설계를 찾아라"가 성립. 예산(0051)·멀티-AZ·복제(0019)·AZ 박스(0050)가 전부 의미를 얻음.
- **기존 자산 재사용** — 도달성 엔진(0047)을 죽은-노드 필터만 얹어 재활용. 별 판정·Terraform 불변.
- **무회귀** — deadNodeIds 없으면 완전히 기존 동작. 186개 테스트 green(신규 chaos 4).
- **한계(v1)** — 단일 AZ 장애만(동시 다중 AZ 미지원). RDS 읽기 복제본 자동 승격은 미모델(Multi-AZ만 생존) — DR 미션의 복제본은 별도 복원력 서사. ALB는 2-AZ 강제(checks)라 AZ 독립으로 간주해 생존. 향후 등급(Well-Architected)·다중 장애로 확장 가능.
