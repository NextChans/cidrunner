# 0030. 인터랙티브 튜토리얼 — 단계별 자가 점검 힌트

- Status: Accepted (extends [ADR 0014](0014-mission-clear-detection-and-stars.md))
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

첫 방문 온보딩 오버레이([ADR 0023](0023-editor-fundamentals.md))는 "드래그로 중첩·연결은
엣지·재생" 세 개념만 1회 보여주고 사라진다. 이후 튜토리얼 미션(`tutorial`)은 단일 `hint`
한 줄과 0–3 star `check`만 제공해, 초심자가 "지금 뭘 해야 하는지"를 실시간으로 알기 어렵다.
Sprint C 목표는 이 첫 미션을 **단계별로** 강화하되, 기존 미션 clear 로직은 건드리지 않는
것이다.

## Decision

**미션 타입에 backward-compatible `steps?: TutorialStep[]`를 추가한다.**

```ts
interface TutorialStep {
  text: string                              // 플레이어용 지시문
  done: (ctx: MissionCheckContext) => boolean // 라이브 그래프로 재평가
}
```

- **오직 튜토리얼 미션만** 이 필드를 채운다. 나머지 9개 미션은 `steps === undefined`로
  기존과 완전히 동일하게 동작한다(테스트로 고정).
- 4단계: ① VPC 배치 → ② VPC 안에 퍼블릭 Subnet → ③ 설정 오류 0 → ④ IGW 연결(별 3개).
  각 `done`은 star `check`가 쓰는 것과 **같은 조건**을 재사용한다(공용 헬퍼
  `hasPublicSubnetInVpc`로 중복 제거) — 힌트와 채점이 어긋나지 않게.
- `MissionPanel`은 **활성** 미션이 `steps`를 가지면 체크리스트를 렌더한다. `ctx`가 그래프
  변경마다 재계산되므로 완료 단계는 취소선·체크로 꺼지고, 첫 미완 단계(`nextIndex`)가
  "다음 할 일"로 강조된다 — 별도 상태 없이 파생값만으로 실시간 갱신.

clear 판정·star 로직은 [ADR 0014](0014-mission-clear-detection-and-stars.md) 그대로다.
`steps`는 순수 UI 가이드이며 채점에 영향을 주지 않는다.

## Consequences

- **좋은 점**: 초심자가 온보딩 종료 후에도 다음 행동을 실시간으로 안내받는다. 데이터로
  선언하는 방식이라 다른 미션에도 필요할 때 점진 도입 가능. `done`이 `check`와 조건을
  공유해 유지보수 지점이 하나.
- **나쁜 점 / 한계**: ③ "설정 오류 0"은 노드 0개일 때 `allValid`가 vacuously true라 빈
  캔버스에서 미리 체크된 것처럼 보인다(★2 규칙과 동일 동작) — 단, `nextIndex`는 여전히
  ① VPC를 가리켜 안내 흐름은 정상. 단계는 순차 완료를 가정하지 않고 각자 독립 평가한다.
- **후속 영향**: 원한다면 `steps`를 3-tier 등 복잡 미션으로 확장하거나, 온보딩에서 바로
  튜토리얼 단계로 이어지는 딥링크를 붙일 수 있다.
