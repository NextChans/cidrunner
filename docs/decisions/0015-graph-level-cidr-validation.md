# 0015. Graph-level CIDR validation

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

Phase 2의 검증([ADR 0011](0011-inspector-property-form-and-validation.md))은
노드 하나의 설정만 본다(`validate(config)`). 그런데 CIDR의 정합성은 관계적이다 —
"VPC나 서브넷의 CIDR 블록이 겹치면 안 되지 않을까?"라는 지적처럼, 개별 노드가
아니라 **그래프 전체**를 봐야 잡히는 오류가 있다. 어떤 규칙을 강제하고 어디서
계산할지 정해야 한다.

## Decision

실제 AWS 규칙에 맞춰 **두 가지만 강제**한다
([`src/graph/cidr.ts`](../../src/graph/cidr.ts)):

1. **포함(containment)** — Subnet CIDR은 부모 VPC CIDR 범위 안에 있어야 한다.
2. **형제 간 비중첩(no sibling overlap)** — 같은 VPC 안의 Subnet끼리 CIDR이
   겹치면 안 된다.

**VPC 간 중첩은 허용**한다 — AWS도 허용하며(피어링 시에만 문제), 게임 규칙을
실제보다 엄격하게 만들지 않는다.

구현: CIDR을 uint32 범위로 파싱(`parseCidr`)해 포함/중첩을 계산하고, 노드 id →
한국어 오류 메시지 배열의 `Map`을 반환한다(`cidrIssues`). 형식 오류는 per-node
`validate`가 이미 잡으므로 여기서는 건너뛴다. 결과는 store의 `nodes` 배열 참조를
키로 `WeakMap`에 메모이즈(`getCidrIssues`)해서, 여러 노드 렌더러가 한 번의 계산을
공유한다.

UI 연결: 노드 빨간 테두리(ResourceNode), Inspector 오류 배지 + 메시지 목록
(PropertyForm), 미션 별점의 `allValid`(MissionPanel)에 모두 반영된다.

**주의(교훈)**: zustand 셀렉터에서 `map.get(id) ?? []`처럼 **폴백으로 새 참조를
만들면 안 된다** — 스냅샷마다 새 배열이 반환되어 무한 리렌더로 크래시한다.
셀렉터는 캐시된 배열(또는 `undefined`)을 그대로 반환하고 폴백은 렌더 단계에서
처리한다.

## Consequences

- **좋은 점**: 실제 AWS에서 배포가 깨지는 두 가지 CIDR 실수를 편집 중에 즉시
  잡아준다. 계산이 한곳에 모여 있고 메모이즈되어 노드 수가 늘어도 부담이 적다.
- **나쁜 점 / 한계**: IPv6, 보조 CIDR 블록, AWS 예약 주소(각 서브넷의 5개)는
  다루지 않는다. VPC 간 중첩 경고(피어링 대비)도 없다.
- **후속 영향**: 관계형 검증이 더 필요해지면(예: NAT는 퍼블릭 서브넷에만) 같은
  패턴 — `src/graph/`의 그래프 검사 + `getCidrIssues`식 메모이즈 — 을 따른다.
