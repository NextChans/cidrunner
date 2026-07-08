# 0029. 성능 — 번들 code-splitting & 대형 그래프 렌더링

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

Sprint B([meeting](../meetings/2026-07-09-standup-and-sprint-planning.md)) 종료 시점에
`vite build`가 단일 JS 청크 **574.76 kB**(gzip 180.42)를 뱉으며 rolldown의 500 kB 경고를
띄웠다. 리소스 20종·미션 10종으로 콘텐츠가 늘며 초기 페이로드가 계속 커질 추세였고,
Sprint C의 새 UI(단축키 도움말·컨텍스트 메뉴)까지 얹으면 더 나빠진다. 또한 100+ 노드
설계에서 pan/zoom 시 렉 여부를 점검해야 했다(스프린트 목표: 측정·문서화).

빌드 스택은 Vite 8 + rolldown 1.1.4다. rollup 시절 `manualChunks` 대신 rolldown은
`output.codeSplitting`(구 `advancedChunks`, deprecated)을 쓴다.

## Decision

**청크 전략 — `vite.config.ts`의 `build.rolldownOptions.output.codeSplitting.groups`.**
그룹은 위에서 아래로 매칭되므로 순서가 중요하다.

1. `react-flow` — `node_modules/@xyflow/**` (단일 최대 의존성)을 독립 청크로.
2. `vendor` — 나머지 `node_modules`. **단, JSZip은 제외**(test 함수로 필터)해서
   `terraform.ts`의 동적 import가 자연스러운 lazy 청크로 남도록 한다. named 그룹의 `test`가
   매칭하면 동적 import보다 우선해 vendor로 끌려들어가기 때문에, 제외가 필수였다.

**Lazy import.** (1) JSZip은 `downloadTerraformZip` 안에서 `await import('jszip')` —
내보내기를 실제로 누를 때만 fetch. (2) 초기 화면에 불필요한 UI인 `Onboarding`(첫 방문
1회), `ShortcutHelp`(`?`), `NodeContextMenu`(우클릭)는 `React.lazy` + `Suspense(fallback=null)`.

**대형 그래프.** React Flow에 `onlyRenderVisibleElements`를 켜 뷰포트 밖 노드/엣지를
컬링한다. `ResourceNode`는 이미 `memo`, 각 컴포넌트는 zustand 필드 단위 selector를 써
과도 렌더가 없음을 확인(추가 memo는 불필요 — over-engineering 회피).

### 측정 결과

빌드 청크(gzip):

| 청크 | 변경 전 | 변경 후 |
| ---- | ------- | ------- |
| (단일 index) | **574.76 kB** (180.42) | — |
| index (앱 코드) | — | 97.99 kB (30.17) |
| react-flow | — | 188.98 kB (60.96) |
| vendor | — | 195.63 kB (62.97) |
| jszip (lazy) | (포함) | 95.88 kB (28.45) |
| Onboarding / ShortcutHelp / NodeContextMenu (lazy) | (포함) | 2.91 / 2.41 / 1.77 kB |

**최대 청크 574.76 → 195.63 kB. 500 kB 경고 소멸.** 초기 JS(index+react-flow+vendor+runtime)
≈ 483 kB로 이전 단일 청크 대비 ~91 kB 감소, JSZip(95.88)은 export 전까지 로드되지 않는다.

100노드 측정: 로컬 dev에서 100노드 fixture JSON을 생성해 "불러오기"로 로드한 뒤 pan/zoom.
`onlyRenderVisibleElements` 적용 후 체감 렉 없음. fixture는 저장소에 커밋하지 않는다(1회성
측정용). 그래프 검증(`getGraphIssues`)이 노드마다 O(edges) 스윕을 도는 구조라 노드 수가
수백대로 커지면 재점검 여지가 있으나 현 목표 범위(100대) 밖.

## Consequences

- **좋은 점**: 경고 해소 + 초기 페이로드 감소. JSZip·온보딩·모달·메뉴가 필요 시에만
  네트워크를 타 첫 로드가 가벼워진다. 청크 분리로 vendor 캐시가 앱 코드 변경과 무관하게
  유지돼 재방문 캐시 적중률도 개선.
- **나쁜 점 / 한계**: lazy 컴포넌트는 최초 표시 때 아주 짧은 fetch 지연이 있으나 크기가
  작아(<3 kB) 무시 가능. `codeSplitting`는 rolldown 전용 API라 순수 Vite/rollup으로
  되돌리면 재작성 필요.
- **후속 영향**: 리소스/미션이 더 늘면 데이터 모듈(resources·missions)도 청크 후보.
  대규모 그래프 대비 `getGraphIssues` 메모이제이션은 성능 이슈가 실제로 관측될 때.
