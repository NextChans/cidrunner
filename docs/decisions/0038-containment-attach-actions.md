# 0038. Containment attach 액션 대칭화 — drop-onto-parent + 우클릭 "부모에 넣기"

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

차니 리포트 2건이 containment(중첩) UX의 비대칭을 지적했다.

1. **드래그로는 nest가 안 된다** — 팔레트에서 캔버스로 **새로** 드롭할 때는
   `findDropParent`가 컨테이너를 판정해 자동 nesting했지만([ADR 0001](0001-mvp-scope-and-resource-set.md)
   의 nesting 규칙), 이미 캔버스에 있는 노드를 subnet/VPC 위로 드래그하면 아무 일도
   일어나지 않았다. `onNodeDragStop` 핸들러가 없었다.
2. **분리는 되는데 복구가 안 된다** — 우클릭 메뉴에 "부모에서 분리"([ADR 0028](0028-keyboard-shortcuts-and-context-menu.md))
   만 있고 "부모에 넣기"가 없어, 한 번 분리한 노드를 다시 컨테이너에 넣을 방법이 드래그
   말고는 없었다(그 드래그마저 1번 이유로 동작 안 함).

## Decision

**드래그 자동 nest**와 **우클릭 "부모에 넣기"**를 대칭 액션으로 추가한다. 둘 다
단일 스토어 액션 `attachToParent(nodeId, parentId)`로 수렴한다.

- **스토어 `attachToParent`** — 새 부모 검증(`isContainer` + `canContain`,
  [rules.ts](../../src/graph/rules.ts) 준수), 사이클 방지(대상이 자기 자손이면 no-op),
  현재 부모와 동일하면 no-op. 통과 시 노드의 **절대 좌표를 새 부모 상대 좌표로 변환**
  (`absolutePosition`으로 부모 체인의 오프셋을 접음)하고 `extent: 'parent'`를 설정한다.
  마지막으로 `orderByParent`로 배열을 **위상 정렬**한다 — React Flow는 부모가 자식보다
  배열 앞에 있어야 렌더 순서가 맞기 때문.
- **Drop-onto-parent (드래그)** — `Canvas`의 `onNodeDragStop`이 드래그된 노드의
  **중앙 절대 좌표**(`getInternalNode().internals.positionAbsolute` + `measured` 크기)를
  구해, 자신과 자손을 제외한 컨테이너 중 가장 안쪽(area 최소)을 `findDropParent`로 찾아
  `attachToParent`를 호출한다. `findDropParent`는 `excludeIds` 인자를 받아 팔레트 드롭
  (제외 없음)과 노드 드래그(자기+자손 제외)에 공용된다.
- **우클릭 "부모에 넣기"** — `NodeContextMenu`가 규칙상 허용되는 후보 컨테이너(자기
  부모·자손 제외)를 flyout 서브메뉴로 띄운다. 항목 클릭 시 `attachToParent`. 이미 부모가
  있으면 라벨이 **"부모 변경"**, 없으면 **"부모에 넣기"**. 후보 0개면 비활성.

### 자동 detach는 넣지 않는다

캔버스 밖으로 드래그 시 자동 분리는 넣지 않았다. 모든 nested 노드는 `extent: 'parent'`로
부모 bbox에 갇혀 있어 물리적으로 밖으로 끌어낼 수 없다 — 자동 detach는 사실상 죽은
코드가 된다. 분리는 우클릭 "부모에서 분리"가 담당(이미 절대 좌표로 변환).

### 대안

- **드래그 좌표 변환을 Canvas에서 직접 setNodes** — 좌표 접기·배열 재정렬·규칙 검증이
  스토어 밖으로 새면 우클릭 경로와 중복된다. 단일 `attachToParent`로 통일.
- **모달로 부모 선택** — flyout보다 무겁고, 우클릭 메뉴의 즉시성과 어긋나 기각.

## Consequences

- **좋은 점**: 분리 ↔ 재부착이 완전 대칭. 분리한 노드를 드래그로도, 우클릭으로도 되돌릴
  수 있다. 좌표는 항상 보존(절대→상대 변환)되어 노드가 화면에서 튀지 않는다. 규칙 검증이
  두 경로에서 강제된다.
- **나쁜 점 / 한계**: `extent: 'parent'` 때문에 **이미 nested된 노드를 드래그로 다른
  컨테이너로 옮기는 것**은 두 컨테이너가 겹치지 않는 한 불가 — 그 경우 우클릭 "부모 변경"을
  써야 한다. drop 판정은 노드 **중앙점** 기준(부분 겹침은 무시).
- **후속 영향**: drop 거부 시 hover 시각 피드백(빨간 테두리 등)은 미구현 — 후속 여지.
