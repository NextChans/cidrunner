# 0053. 카오스 모드 RDS 복원 — Multi-AZ 페일오버 & 읽기 복제본 승격

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0019](0019-rds-read-replica-as-edge.md), [0052](0052-chaos-mode-fault-injection.md)

## Context

카오스 모드(ADR 0052)에서 AZ를 다운시켰을 때, RDS의 복원 동작이 두 가지 모두 부정확/불명확하다는 피드백:

1. **Multi-AZ RDS**가 죽은 AZ 서브넷 안에서 살아있는(dimmed 박스 안 alive) 모습이 "버그처럼" 보임 — 자동 페일오버로 생존하는 게 맞지만 표시가 없어 혼란.
2. **읽기 복제본**이 카오스에서 아무 역할도 안 함 — 사용자 기대는 "마스터가 죽으면 Slave가 이어받는다".

두 개념은 AWS에서 다르다: **Multi-AZ**는 다른 AZ의 동기 스탠바이로 **자동 페일오버(동일 엔드포인트, 승격 아님)**, **읽기 복제본**은 비동기 복제본으로 장애 시 **수동 승격(promote)**이 필요하다.

## Decision

`graph/chaos.ts`에 `applyAzFault(nodes, edges, az)`를 추가해 AZ 장애의 전체 효과를 계산한다.

- **Multi-AZ 페일오버** — 죽은 AZ에 있는 `multi_az: true` RDS는 **생존**(`deadNodesForAz`가 이미 제외)하고 `failoverIds`에 담긴다. UI는 **⚡ 페일오버** 배지로 "죽은 게 아니라 스탠바이로 넘어감, 동일 엔드포인트"를 명시.
- **읽기 복제본 승격** — 죽은 **단일-AZ** 마스터가 살아있는 다른 AZ에 읽기 복제본(rds → rds 엣지)을 가지면, 복제본을 **승격**(`promotedIds`)하고 **마스터를 향하던 요청 트래픽 엣지를 복제본으로 재라우팅**(`edges` 재작성). UI는 **⬆ 승격** 배지 + 승격된 복제본이 경로에 초록으로 활성.
- 시뮬은 `simulate(nodes, faultEdges, { deadNodeIds, failoverIds, promotedIds })`로 재라우팅된 엣지 + 죽은 집합을 받아 기존 백트래킹 도달성으로 생존/차단 판정. `SimResult`에 `failoverNodeIds`·`promotedNodeIds` 에코(렌더용).
- 스토어의 `runWithChaos`가 `chaosAz` 활성 시 `applyAzFault`를 적용.

## Consequences

- **정확성 + 게임성** — Multi-AZ는 승격 없이 동일 엔드포인트로 생존(AWS 정확), 단일-AZ 마스터는 복제본 승격으로 이어받음(사용자 직관 + DR 학습). 복제본이 카오스에서 처음으로 의미를 가짐.
- **혼란 해소** — 죽은 AZ 안에 살아있는 Multi-AZ RDS가 ⚡ 페일오버 배지로 설명됨.
- **무회귀** — deadNodeIds/failoverIds/promotedIds 없으면(=정상 sim) 완전 기존 동작. 별 판정·Terraform 불변. 테스트 187→**189**(chaos 페일오버·승격).
- **한계(v1)** — 마스터당 복제본 1개 승격, 단일 AZ 장애만. Multi-AZ와 복제본이 함께 있으면 Multi-AZ가 우선(마스터가 안 죽으므로 승격 불필요). RDS 외 리소스의 크로스-AZ 상태 복제(예: ElastiCache)는 미모델.
