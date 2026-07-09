# 0049. 엣지 in/out 트래픽 시각 효과 — 방향 인지도 강화

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0012](0012-traffic-simulation-model.md), [0043](0043-derived-visual-edges.md), [0047](0047-simulate-backtracking.md)

## Context

트래픽 파티클이 엣지 위를 흐르지만 "들어오는 트래픽(in) vs 나가는 트래픽(out)"의 구분과 성공/실패 상태가 시각적으로 명확하지 않았다. 파티클은 이동 방향을 어느 정도 보여주나, 엣지 양끝의 in/out 이벤트와 sim 성공(녹색)/차단(빨강)을 구별하는 신호가 없었다. SG 부착(rose 점선)·복제(indigo 점선)·파생(slate 점선) 엣지와의 시각 구별은 유지해야 한다.

## Decision

트래픽 엣지에 **방향 in/out pulse**와 **성공/차단 색상**을 추가한다.

- **`SimResult.edgeStatus`** — `Record<edgeId, 'ok' | 'blocked'>`. 성공 flow 위 엣지는 `'ok'`, 실패 flow에만 있는 엣지는 `'blocked'`. 공유 엣지는 `'ok'` 우선. (ADR 0047에서 실패 flow도 `pathEdgeIds`를 반환하도록 해 차단 엣지를 식별 가능.)
- **out pulse (source)** — 엣지 시작 핸들(sourceX/Y)에서 **확산하는 링**(r 1→7, opacity 0.9→0). 트래픽이 나가는 지점.
- **in pulse (target)** — 엣지 종료 핸들(targetX/Y)에서 **수렴하는 링**(r 7→1), 사이클 절반 지연으로 도착을 표현.
- **색상** — `'blocked'`는 rose(`#fb7185`), 그 외 emerald(`#34d399`). 이동 파티클·엣지 stroke·in/out 링 모두 동일 색으로 통일해 한눈에 성공/차단 판별.
- **타이밍** — fan-out 엣지(ADR 0048)는 라운드로빈 슬롯 begin, 경로 엣지는 hop begin을 그대로 사용해 세 효과(파티클·out·in)가 한 사이클로 동기화.

구현은 [TrafficEdge](../../src/components/edges/TrafficEdge.tsx)의 SVG `<animate>`/`<animateMotion>`. 부착·복제 엣지의 조기 반환 분기는 그대로 두어 다른 엣지 타입의 대시 스타일과 구별 유지.

## Consequences

- **방향·상태 인지** — 엣지마다 나가는 확산 링 + 들어오는 수렴 링으로 흐름 방향이 명확하고, 색으로 sim 성공/차단이 즉시 구분됨.
- **백트래킹·fan-out과 정합** — 성공 경로는 녹색 in/out, 막힌 엣지는 빨강 in/out. LB fan-out(ADR 0048)의 dead 타깃 엣지는 경로 밖이라 `edgeStatus` 미지정 → 녹색(LB는 분산)으로 그리되, 대상 노드는 red로 dead임을 표시.
- **성능** — 활성 엣지에만 `<animate>` 부착(엣지당 링 2개·4 애니메이션). sim은 소수 엣지만 활성. 100 노드에서 부드러움.
- **회귀 없음** — SG/복제/파생 엣지 렌더 경로 무변경. 비활성 엣지는 기존과 동일.
- **테스트** — `edgeStatus`의 ok/blocked 판정을 `simulate-edge.test.ts`에 락인(시각 효과 자체는 렌더 계층이라 브라우저 프리뷰로 확인 — 5 엣지·이동 파티클 5·in/out 링 20 검증).
