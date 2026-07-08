# 0009. 좁은 뷰포트용 반응형 drawer 패턴

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

지금까지 UI는 데스크톱 전용 3분할 레이아웃(Palette / Canvas / Inspector,
+ Inspector 하단에 MissionPanel)이었다. 이 레이아웃을 모바일(<768px)에서 열면
좌우 aside가 가로 공간을 다 잡아먹어 Canvas가 사실상 사라지고 화면이 깨졌다.

고려한 힘(forces):

1. **인프라 편집은 본질적으로 데스크톱 UX다.** 여러 리소스를 배치·연결·편집하는
   작업은 넓은 화면과 정밀 포인터가 전제다. 모바일에서 이걸 다 하게 만드는 것은
   목적에 맞지 않는다.
2. **그러나 모바일 첫인상은 방어해야 한다.** 링크를 모바일로 여는 사람이 많고,
   그 순간 화면이 깨져 있으면 프로젝트 신뢰도가 떨어진다. 최소한 "보기·데모"는
   되어야 한다.
3. **완전한 mobile-first 재설계는 스코프 폭발이다.** 데스크톱 UX를 그대로 두면서
   모바일에서만 다른 셸을 얹는 접근이 비용 대비 효과가 가장 좋다.
4. **React Flow는 터치 pan/zoom을 기본 지원한다.** Canvas만 전체 화면으로 잘
   보이면 "보기"의 절반은 이미 해결된다.

## Decision

Tailwind 기본 `md` breakpoint(768px)를 경계로 두 개의 셸을 운영한다.

- **≥768px (데스크톱)**: 기존 3분할 레이아웃을 그대로 유지한다. Palette(`w-56`) /
  Canvas(`flex-1`) / Inspector(`w-72`, 하단 MissionPanel 포함). regression 0.
- **<768px (모바일)**: Canvas가 전체 뷰포트를 차지하고, 세 패널은
  **오버레이 drawer / bottom sheet**로 전환한다.
  - Palette → 좌측 drawer, Inspector → 우측 drawer, MissionPanel → 하단 sheet
    (`max-h-[70vh]`).
  - 헤더 우측에 `md:hidden` 아이콘 버튼 3개(리소스 / 미션 / 인스펙터)를 두어
    각 drawer를 연다. 데스크톱 Toolbar는 `hidden md:block`으로 감춘다.
  - **노드를 선택하면 모바일에서 Inspector drawer가 자동으로 열린다**
    (`setSelected`가 `window.matchMedia('(max-width: 767px)')`로 판별).
  - Palette에서 리소스를 추가하면 좌측 drawer는 자동으로 닫힌다.

drawer 상태는 Zustand `useGraphStore`에
`mobileDrawers: { palette; inspector; missions }` + `setDrawer(which, open)`로만
추가한다. 데스크톱 코드 경로는 이 상태를 읽지 않는다.

각 패널 컴포넌트는 내부 콘텐츠(`PaletteBody` / `InspectorBody` / `MissionList`)와
데스크톱 aside 래퍼를 분리해, 동일한 콘텐츠를 데스크톱 aside와 모바일 drawer가
공유한다(중복 렌더 로직 없음).

### drawer 애니메이션 — Framer Motion 대신 CSS transition

애초 계획은 이미 의존성에 있던 Framer Motion(`AnimatePresence`)으로 slide-in/out을
구현하는 것이었다. 그러나 React 19 StrictMode에서 `AnimatePresence`의 exit 애니메이션
완료 콜백이 안정적으로 발화하지 않아, **닫힌 drawer의 오버레이(`fixed inset-0`)가
DOM에 남아 캔버스 탭을 가로채는** 문제가 관측됐다. 애니메이션 완료 시점에 의존해
unmount하는 방식 자체가 취약했다.

그래서 drawer는 **항상 마운트해 두고 순수 CSS transition**으로 여닫는다.

- 닫힘: 패널을 화면 밖으로 `translate3d(…)`(인라인 스타일) + 래퍼에
  `pointer-events-none`. → **애니메이션 상태와 무관하게 닫힌 drawer는 절대 탭을
  가로채지 않는다.**
- 열림: `translate3d(0,0,0)` + 백드롭 opacity 페이드. `transition-transform`로 슬라이드.
- transform은 Tailwind `translate-*` 유틸리티가 아니라 **인라인 스타일**로 준다.
  Tailwind 유틸리티는 상태가 바뀌어도 `translate(var(--tw-translate-x)…)`라는
  동일한 문자열만 내보내고 CSS 변수만 교체하는데, transition이 이 var 기반 transform을
  재보간하지 못해 패널이 화면 밖에 멈춰버린다. 서로 다른 인라인 문자열은 정상 보간된다.
- 닫기 트리거: 백드롭 클릭 · 우상단 X · Escape 키. body scroll은 열려 있는 동안만 잠근다.

한 번에 여러 drawer가 열리는 상황은 전체 화면 백드롭(`z-50`)이 헤더 버튼·캔버스를
모두 덮어, 자연히 한 번에 하나만 열리도록 강제된다.

## Consequences

- **좋은 점**
  - 모바일에서도 프로젝트를 보기·데모할 수 있다. Canvas가 전체 화면이라 React Flow
    터치 pan/zoom이 그대로 살아난다.
  - 데스크톱 UX regression이 없다(3분할 그대로).
  - 추가 의존성 0 — Tailwind transition만 사용. Framer Motion에도 새로 의존하지 않는다.
  - 닫힌 drawer가 애니메이션 프레임 유무와 무관하게 캔버스를 가로채지 않아,
    저사양·백그라운드 탭 등 열화 환경에서도 안전하다.
- **나쁜 점 / 유의점**
  - 모바일에서 다중 리소스 배치·정밀 편집은 여전히 불편하다 — 원래 데스크톱 UX가
    목적이므로 의도된 한계다.
  - Zustand store에 `mobileDrawers` 상태가 추가되어 스토어 복잡도가 미세하게 늘었다.
  - `setSelected`가 `window.matchMedia`를 참조해 store가 브라우저 환경에 약하게
    결합됐다(`typeof window` 가드로 SSR/테스트는 방어).
  - Framer Motion이 이제 코드에서 쓰이지 않는다(트리쉐이킹되어 번들에는 빠짐).
    의존성 제거는 별도 정리 대상으로 남긴다.
- **후속 영향**
  - Phase 1(드래그드롭)·Phase 2(속성 편집 폼)이 들어오면 모바일 drawer 안에서의
    입력 UX(가상 키보드, tap 타깃)를 다시 점검해야 한다.
