# 0032. Achievements — 배지 시스템

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

미션 clear·별점([ADR 0014](0014-mission-clear-detection-and-stars.md))은 미션 카드 안에서만
드러난다. 진행도를 한눈에 보여주고 성취감을 주는 메타 레이어(배지)가 없었다. Sprint D 목표는
가벼운 배지 시스템을 붙이되 **기존 미션 채점 로직은 절대 건드리지 않는 것**.

## Decision

**배지는 이미 저장된 진행도에서 파생되는 순수(derived) 상태로 정의한다.** 새 카운터도, 미션
grading에 대한 훅도 없다.

```ts
interface BadgeContext { bestStars: Record<string, number>; slotCount: number; missionCount: number }
interface Badge { id; icon; title; description; earned: (c: BadgeContext) => boolean }
```

배지 5개(`src/graph/achievements.ts`, 쉬운→어려운 순):

| id | 아이콘 | 조건 |
| -- | ----- | ---- |
| `first-mission` | 🥇 | 별 1개 이상 미션 1개 |
| `first-three-star` | ⭐ | 별 3개 미션 1개 |
| `first-slot` | 🎨 | 갤러리 슬롯 1개 이상 ([ADR 0033](0033-gallery-multi-slot.md)) |
| `five-missions` | 🎯 | 별 1개 이상 미션 5개 |
| `all-three-star` | 🏆 | 전 미션 별 3개 |

- **입력**은 이미 persist되는 `bestStars`(ADR 0014·0023)와 갤러리 `slots.length` 뿐이다.
  배지 predicate는 순수 함수라 단위 테스트로 고정한다.
- 스토어는 **어떤 배지를 이미 알렸는지**(`earnedBadges: string[]`)만 추가로 persist한다.
- `useAchievements` 훅(App에 1회 마운트)이 파생 earned 집합을 감시한다. **마운트 첫 패스는
  기존 진행도로 이미 충족된 배지를 조용히 백필**하고(로드 시 토스트 폭탄 방지), 이후 세션 중에
  새로 열린 배지만 기존 `notice` 토스트(`🎉 배지 획득: …`)로 1회 알린다.
- UI: 툴바 트로피 아이콘(획득 수 배지 chip) → lazy-load 모달(`Achievements.tsx`)에 전체 목록을
  획득/잠금 상태로 표시.

## Consequences

- **좋은 점**: 미션 채점과 완전히 분리 — 단일 진실원(`bestStars`)에서 파생되므로 어긋날 수 없다.
  배지 추가는 predicate 한 줄. persist 스키마는 `earnedBadges` 하나만 늘어 backward-compatible
  (버전 미변경, 기존 저장 설계 보존).
- **나쁜 점 / 한계**: 파생 방식이라 "100번째 apply" 같은 **누적 이벤트형 배지**는 별도 카운터가
  필요해 이번 5종에서 제외했다(계획서의 🚀 후보 보류). 백필 로직상, 기능 도입 이전에 이미 미션을
  깬 사용자는 첫 로드에서 토스트 없이 배지를 갖게 된다(의도된 동작).
- **후속 영향**: 이벤트형 배지가 필요해지면 `apply`/`export` 카운터를 persist에 추가하고
  `BadgeContext`를 확장하면 된다.
