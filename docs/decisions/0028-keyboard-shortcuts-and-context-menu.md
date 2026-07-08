# 0028. 키보드 단축키 & 노드 우클릭 컨텍스트 메뉴

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

Sprint C([meeting](../meetings/2026-07-09-standup-and-sprint-planning.md)) UX 심화의
핵심은 편집 접근성이다. 지금까지 편집은 전부 포인터 조작이었다 — 삭제는 인스펙터의
"노드 삭제" 버튼, 복제는 부재, 시뮬 시작·내보내기는 툴바 버튼뿐이었고, 단축키는
[ADR 0023](0023-editor-fundamentals.md)에서 도입한 Undo/Redo(⌘Z/⌘⇧Z/⌘Y)가 `App.tsx`에
인라인으로 박혀 있었다. 파워 유저가 키보드로 흐름을 유지할 수 없고, 노드마다 오른쪽
인스펙터를 오가야 하는 왕복 비용이 컸다.

두 가지를 함께 결정한다: (1) 편집·실행 동작 전반을 아우르는 **글로벌 단축키 세트**,
(2) 노드에서 바로 쓰는 **우클릭 컨텍스트 메뉴**.

## Decision

**단축키 — `src/hooks/useKeyboardShortcuts.ts`로 통합.** `App.tsx`의 인라인 리스너를
걷어내고 하나의 훅으로 모은다. 훅은 `R`(fit view)이 React Flow 인스턴스를 필요로 하므로
`ReactFlowProvider` 내부(`Layout`)에서 마운트한다.

| 키 | 동작 |
| -- | ---- |
| `⌘/Ctrl+Z` | undo |
| `⌘/Ctrl+Shift+Z`, `Ctrl+Y` | redo |
| `⌘/Ctrl+D` | 선택 노드 복제 |
| `Delete` / `Backspace` | 선택 삭제(노드+하위+선택 엣지) |
| `Escape` | 컨텍스트 메뉴·도움말 닫기, 없으면 선택 해제 |
| `R` | 화면에 맞추기 |
| `S` | 트래픽 시뮬 시작 / 중지 |
| `E` | Terraform(.tf) 내보내기 |
| `?` | 단축키 도움말 모달 토글 |

**Focus guard.** `INPUT`·`TEXTAREA`·`SELECT`·`contenteditable`에 포커스가 있으면 모든
단축키를 무시한다 — 단 하나의 예외가 `Escape`로, 입력 중에도 메뉴/모달을 닫을 수 있어야
하므로 guard 이전에 처리한다. 그 외에는 인쇄 가능한 bare 키(`R/S/E/?`)가 타이핑과
충돌할 수 없다(입력창에선 애초에 안 걸리므로). 도움말 버튼(⌨️ 아이콘)을 툴바에 추가하고,
치트시트는 `ShortcutHelp.tsx` 모달(⌘/Ctrl은 플랫폼별 표기)로 제공한다.

**컨텍스트 메뉴 — `src/components/NodeContextMenu.tsx`.** React Flow `onNodeContextMenu`로
열고, 스토어에 `contextMenu: {nodeId, x, y} | null` 상태를 둔다. 화면 좌표(`clientX/Y`)에
앵커하고 뷰포트 경계에서 clamp한다. 항목은 **속성 편집**(→ `setSelected`, 인스펙터 포커스;
모바일은 드로어 오픈) · **복제** · **엣지 지우기**(해당 노드 관련 엣지 전부 제거) ·
**부모에서 분리**(parent-child 해제, 절대 좌표로 변환; 부모 없으면 비활성) · **삭제**.
바깥 클릭·`Escape`로 닫힌다.

**스토어 액션(모두 `nodes`/`edges`만 변경 → zundo undo에 자동 편입).**
`deleteSelection`(선택 노드+하위+선택 엣지), `duplicateNode`(하위 트리를 새 id로 복제,
컨테이너 내부 엣지도 리맵, 루트만 오프셋), `clearNodeEdges`, `detachNode`(부모 체인을
접어 절대 좌표 산출).

## Consequences

- **좋은 점**: 키보드만으로 편집·재생·내보내기 전 흐름을 유지. 우클릭으로 왕복 없이
  즉시 조작. Undo/Redo가 다른 단축키와 한 곳에 모여 유지보수 용이. 새 편집 액션이 전부
  `nodes/edges` 변경이라 실행 취소가 공짜로 따라온다.
- **나쁜 점 / 한계**: `Backspace`를 삭제로 쓰면 실수 여지가 있으나 focus guard와 undo로
  완화. bare 키(R/S/E) 단축키는 향후 다른 기능과 충돌 가능 — 필요 시 modifier로 이전.
  컨텍스트 메뉴의 뷰포트 clamp는 고정 크기(가로 200·세로 220px) 가정이라 항목이 크게
  늘면 재계산 필요.
- **후속 영향**: 단축키 안내를 온보딩([ADR 0023](0023-editor-fundamentals.md))과 연계할
  여지. `ShortcutHelp`·`NodeContextMenu`는 초기 로드에 불필요해 lazy 청크로 분리했다
  ([ADR 0029](0029-perf-code-splitting.md)).
