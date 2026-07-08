# 0011. Inspector property form & validation model

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

Phase 2는 선택한 노드의 설정을 편집하고 실시간으로 검증하는 단계다. 문제는 리소스
10종이 각기 다른 설정 필드(텍스트·숫자·불리언·선택)를 갖는데, 이를 **리소스마다
따로 만든 폼 컴포넌트**로 구현하면 컴포넌트가 리소스 지식으로 오염되고
[ADR 0001](0001-mvp-scope-and-resource-list.md)·[ADR 0010](0010-graph-nesting-and-edge-rule-model.md)에서
지켜온 "데이터 기반 레지스트리" 원칙이 깨진다는 점이다.

## Decision

폼을 **데이터로 선언**한다. `ResourceMeta`에 두 가지를 추가한다.

- `fields?: PropertyField[]` — 각 편집 필드의 `key`/`label`/`type`
  (`text|number|boolean|select`)/`options`/`min`/`max`/`help`. Inspector의
  `PropertyForm`이 이 배열만 읽어 폼을 렌더링한다. 편집 값은 store의
  `updateNodeConfig(id, key, value)`로 바로 반영된다.
- `validate?: (config) => string[]` — 한국어 오류 메시지 배열(빈 배열 = 정상)을
  반환한다. `src/resources/validators.ts`에 재사용 가능한 검사기
  (`validateCidr`/`validateRange`/`validatePattern`)를 모았다.

검증은 렌더링마다 실행되어 **실시간**으로 반영된다. 오류가 있으면 Inspector 헤더에
"오류" 배지와 메시지 목록을, 캔버스 노드에는 붉은 테두리를 표시한다. 편집 속성이
없는 리소스(IGW·NAT)는 `fields`를 생략하고 안내 문구만 보여준다.

### Security Group 규칙 단순화

SG의 실제 ingress/egress 규칙은 포트·프로토콜·CIDR의 배열로 표현력이 크지만, MVP
데모에서 이를 폼으로 편집시키는 것은 과하다. 따라서 SG 설정을 **자주 쓰는 인바운드
토글 3종**(`allow_http` / `allow_https` / `allow_ssh`)으로 축소하고, egress는 emit
시 allow-all로 고정한다. 세밀한 규칙 편집은 범위에서 제외한다.

## Consequences

- **좋은 점**: 폼·검증이 리소스 메타 한곳에서 선언되어 리소스를 추가/수정할 때
  컴포넌트를 건드릴 필요가 없다. Phase 5 미션 클리어 판정이 같은 `validate`
  결과를 재사용할 수 있다.
- **나쁜 점 / 한계**: `PropertyField`가 지원하는 컨트롤이 4종으로 제한된다. 배열/중첩
  객체(원래의 SG 규칙, ALB 리스너 다중 등)는 표현하지 못한다 — SG를 토글로 축소한
  것이 그 대가다.
- **후속 영향**: `validate`가 Phase 2에서 실제로 쓰이기 시작했다(이전엔 미사용
  스텁). 컨트롤 종류나 조건부 필드가 필요해지면 `PropertyField`를 확장하고 이 ADR을
  갱신한다.
