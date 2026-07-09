# 0037. Palette 검색 — debounced 실시간 필터 + `/` 단축키

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

리소스가 26종([ADR 0035](0035-resource-expansion-3-security-and-streaming.md))이
되며 팔레트가 7개 카테고리로 길어졌다. 원하는 블록을 스크롤로 찾기 어렵고, 30종 이상
확장을 앞두고 탐색성이 병목이 된다. 검색이 필요하다.

## Decision

팔레트 상단에 **debounced 실시간 검색**을 추가한다.

- **상태** — 원시 쿼리는 Zustand `search`에 둔다(transient, 미persist). 팔레트가
  데스크톱 aside와 모바일 drawer **두 곳에 동시 마운트**되므로, 단일 스토어 상태를
  공유해 어느 입력에서 타이핑해도 동일하게 필터된다. 모바일 drawer 열림/닫힘과 독립.
- **훅** — `src/hooks/useResourceSearch.ts`가 스토어 쿼리를 **100ms debounce**해
  필터링한다. 순수 필터 `filterResources(query)`를 분리 export(테스트용). 매칭 대상은
  **label(원어) · description(한글) · type(id) · category 라벨**, case-insensitive
  부분 매칭. 빈/공백 쿼리는 전체 리스트를 그대로 반환한다.
- **렌더** — 쿼리 활성 시 매칭 0건인 카테고리는 숨긴다. 전체 0건이면
  "일치하는 리소스가 없습니다" 메시지. 검색어가 있으면 우측 `×` clear 버튼.
- **키보드** — `/`(전역)로 팔레트 검색 포커스. id `palette-search`는 **데스크톱 aside만**
  선언(모바일 drawer 사본은 익명 → DOM id 유일성 보장). 입력창 내 Escape는 로컬
  핸들러가 처리(값 있으면 clear, 없으면 blur) 후 `stopPropagation` — 전역 Escape의
  캔버스 선택 해제로 새지 않게. `/`는 `?`(도움말)와 별개 `e.key`라 충돌 없음.
- **접근성** — input `aria-label`, clear 버튼 `aria-label`, 결과 카운트
  `role="status" aria-live="polite"`(sr-only)로 스크린리더 알림.
- **문서** — ShortcutHelp 모달에 `/` 항목 추가.

### 대안

- **컴포넌트 로컬 useState 쿼리** — drawer/aside 두 인스턴스가 상태를 공유하지 못해
  모바일↔데스크톱 전환 시 불일치. 스토어 단일 소스로 기각.
- **debounce 없는 즉시 필터** — 26종엔 무해하지만 30+·미래 원격 소스 대비 100ms
  창을 둔다(입력 부담 완화, 계획서 명세).

## Consequences

- **좋은 점**: 26종에서 "cog" 3타로 Cognito 도달. `/` 단축키로 마우스 없이 탐색.
  30+ 리소스 확장에도 스크롤 병목이 없다. 카테고리 라벨 매칭으로 "아이덴티티" 검색이
  보안·아이덴티티 그룹 전체를 띄운다.
- **나쁜 점 / 한계**: `/` 포커스는 데스크톱 전용(모바일은 물리 키보드 가정이 약해
  drawer 사본에 id 미부여). 필터는 문자열 부분 매칭만(퍼지/동의어 없음 — 예 "인증"은
  Cognito description에 있어야 매칭). 검색 상태는 세션 한정(미persist).
- **후속 영향**: 리소스 4차 배치가 와도 팔레트 UX가 견딘다. 필요 시 최근/자주 쓰는
  리소스 정렬, 동의어 사전을 얹을 여지.
