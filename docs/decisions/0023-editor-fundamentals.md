# 0023. Editor Fundamentals — undo/redo, 온보딩, 공유 안전화

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude (제품 미팅 [#2](../meetings/2026-07-08-sprint-2-direction.md))

## Context

Save & Share 출시로 설계가 자산이 됐지만, 에디터의 기본 계약 두 가지가 비어
있었다: 실수를 되돌릴 수 없고(undo 부재 — "손이 조심스러워진다"), 첫 방문자가
SG 엣지 문법을 발견하지 못한다. 여기에 시험 운영 중 실제 데이터 손실이 보고됐다:
공유 링크를 열면 확인 없이 자동저장을 덮는다.

## Decision

1. **undo/redo — zundo `temporal`.** 히스토리는 설계 그래프(`nodes`/`edges`)만
   추적한다(temporal partialize — persist의 partialize와 별개). 핵심 장치는
   **debounced-leading 히스토리 캡처**: 연속 제스처(드래그·리사이즈·타이핑)는
   set()을 수십 번 호출하므로, 300ms 무입력 창 기준으로 **버스트당 첫 pre-gesture
   상태 하나만** 기록한다 — 제스처 1회 = undo 1스텝. `limit: 100`. 모듈 레벨
   `nodeSeq`는 단조증가라 undo 후 재추가에도 id 충돌이 없다. undo/redo 시
   transient(simulation/selection)는 초기화한다. 단축키 Ctrl/Cmd+Z·Shift+Z·Y
   (입력 필드 포커스 시 무시) + 툴바 버튼.
2. **공유 안전화.** 공유 링크 로드는 기존 작업(시드에서 벗어난 캔버스)이 있으면
   `confirm`을 거친다. localStorage 키 존재로 판정하지 않는다 — persist가 부팅
   시 즉시 키를 쓰므로 항상 참이 된다. 같은 탭에 URL을 붙여넣는 hash-only
   네비게이션도 `hashchange` 리스너로 처리한다(리로드가 없어 기존에는 무시됐다).
3. **공유에 미션 컨텍스트.** 스냅샷에 `m`(미션 id)을 실어, 제출물을 열면 해당
   미션이 챌린지 모드로 활성화된 채 별점이 바로 보인다. 알 수 없는 미션 id는
   버린다(치명 아님).
4. **첫 방문 온보딩.** localStorage 플래그 기반 1회 환영 오버레이 — 중첩 배치,
   **"SG도 엣지로 연결"**(이 도구만의 문법), 재생/내보내기/Ctrl+Z 세 가지를
   가르치고 [튜토리얼 미션 시작]으로 핸드오프한다. 공유 링크로 진입한 세션에는
   띄우지 않는다.
5. **별점 최고기록.** `bestStars: Record<missionId, number>`를 persist에 추가,
   미션 카드에 "최고 ★n"을 영구 표시한다.
6. **로드 경로 단일화.** persist 리하이드레이트도 `sanitizeSnapshot` 관문을
   거친다. 단, 실패 시 원본을 보존한다 — 로컬 데이터는 외부 URL보다 신뢰하며,
   과잉 정화로 설계를 잃는 것이 더 나쁘다.

## Consequences

- **좋은 점**: 실수 복구·발견 가능성·데이터 안전이라는 에디터 기본기가 채워졌다.
  강사 채점 워크플로우(링크 열기 → 미션·별점 즉시 확인)가 클릭 0회가 됐다.
- **나쁜 점 / 한계**: 히스토리는 세션 메모리 전용(새로고침 시 소실 — 의도).
  debounce 300ms 안에 연속된 별개 조작은 한 스텝으로 합쳐질 수 있다. confirm은
  네이티브 다이얼로그다(커스텀 모달은 후순위).
- **후속 영향**: 다음 스프린트 = 강사용 커스텀 미션(김하영 최소 스펙: title/goal/
  hint/requiredResources + 제네릭 별점 규칙, URL 배포). 신규 미션은 선언적
  술어로 작성해 DSL 재료를 축적한다. 사용 분석은 서비스 선택(오너) 대기.
