# 0041. 미션 체커 감사 — 별점 스코핑 · 힌트/체크 정합

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0036](0036-mission-expansion-3-pipelines-and-auth.md)

## Context

차니 리포트가 두 미션에서 버그를 지적했다:

1. **글로벌 정적 웹(`static-cdn`)**: S3 퍼블릭 액세스 차단을 **켠 채**로 올바르게 지었는데도
   힌트("액세스 차단을 켠 채로 두세요")가 계속 뜨고 별 3개가 안 떴다.
2. **비동기 파이프라인(`async-pipeline`)**: 조건을 만족해도 완료 처리가 안 됐다.

전수 재현 결과 **해피패스(미션 노드만 있는 깨끗한 캔버스)는 12개 미션 모두 ★3에 도달**했다.
버그는 체크 로직 자체가 아니라 **평가 범위(scope)** 였다:

- ★3 조건이 참조하는 `MissionCheckContext.securityOk`는 **그래프 전체**에 경고가 하나도 없어야
  참이다.
- 앱은 첫 로드 시 `VPC ▸ 퍼블릭 Subnet ▸ EC2`(SG 없음) **시드 그래프**를 깐다.
- VPC를 쓰지 않는 미션(정적 웹, 비동기 파이프라인, 서버리스, 이벤트, 데이터 파이프라인)에서
  플레이어는 이 시드를 **건드리지 않는다**. 그러면 시드 EC2의 "연결된 SG 없음" **경고**가
  `securityOk`를 false로 고정 → 이런 미션은 아무리 올바르게 지어도 ★2에 갇혔다.
- 힌트는 정적 문자열이라 실제 블로커(무관한 시드 EC2)와 무관하게 계속 표시됐다.

`allValid`(★2)는 시드에 오염되지 않는다 — 시드는 **에러**가 아니라 **경고**만 낸다.
반응성(Zustand)도 정상이다 — config 토글은 새 `nodes` 배열을 만들어 `useMemo`가 재계산한다.

`async-pipeline`의 그리디 tracer 막다른-엣지 시나리오도 검토했으나, 이는
[simulate-edge.test.ts](../../src/graph/__tests__/simulate-edge.test.ts)가 **의도적으로 락인한**
first-edge 동작이다(별도 이슈로 이월, F2에서 tracer 미변경). 리포트의 실제 증상은 위 시드 오염과
동일 근본원인이다.

## Decision

### 1) 별점 스코핑 — ★3 "보안 경고 0"은 **미션의 연결된 빌드**만 평가

[`src/missions/scope.ts`](../../src/missions/scope.ts)에 `scopedSecurityOk(ctx, anchors)`를 추가.
`anchors`(만족한 sim flow의 `pathNodeIds`)에서 시작해 **엣지(양방향 — SG 부착 엣지는 소스가 SG
이므로 target→source로도 확장)** 와 **컨테인먼트 부모 체인**을 따라 닫힘집합(closure)을 구하고,
그 안에 경고가 없으면 참을 반환한다. `securityOk`를 쓰던 8개 미션(static-cdn, async-pipeline,
container-workload, global-web, event-driven, data-pipeline, secure-auth-web, security-hardening)이
이를 사용하도록 전환.

- 무관한 시드/떠돌이 노드는 closure 밖 → ★3을 막지 않는다.
- SG는 부착 엣지로 closure에 들어오므로 **SSH 개방 SG 경고는 여전히 잡힌다**(하드닝 미션 강도 유지).
- 미션 노드만 있는 깨끗한 그래프에서는 closure == 전체 → 기존 성공 케이스 회귀 없음.
- ★2 `allValid`는 **전체 그래프** 유지: 에러는 apply를 막는 하드 결함이므로 캔버스 어디에도
  없어야 한다는 규칙이 타당하고, 시드에 오염되지도 않는다.

### 2) 힌트/체크 정합

★3이 올바른 빌드에서 실제로 뜨게 되면서, static-cdn 힌트는 이제 **정확한 블로커에만** 반응한다
(예: S3 퍼블릭 차단을 끄면 그 경고가 미션 빌드 안에 있으므로 ★2로 정확히 캡되고 힌트가 맞다).

### 3) 별점 등급 명시적 정의 (12개 미션 규격)

각 미션은 `★1 도달/존재 · ★2 설정 오류 0(전체) · ★3 미션 빌드 보안 경고 0`을 기본 골격으로 하며,
disaster-recovery(복제/Multi-AZ/AZ 분리)와 three-tier(3계층 SG 부착)처럼 도메인 특화 조건을 갖는
미션은 코드 주석에 등급을 명시한다.

## Consequences

- 정적 웹·비동기 파이프라인 등 **VPC 밖 미션이 시드 캔버스에서도 정상적으로 ★3에 도달**한다.
- 미션 신뢰성이 fixture 테스트로 락인된다: [missions.test.ts](../../src/graph/__tests__/missions.test.ts)가
  (a) 12개 캐노니컬 빌드 ★3, (b) 시드 잔존 시에도 ★3, (c) 빌드 내부 경고(S3 public)는 ★2 캡,
  (d) 하드닝의 SSH 개방 SG는 여전히 3★ 미만, (e) 무관 리소스는 무시를 검증.
- 후속 미션 추가 시 `scopedSecurityOk`를 표준으로 사용한다.
- 그리디 tracer 백트래킹 부재는 알려진 제약으로 남긴다(테스트로 락인된 의도된 동작).
