# 0033. 갤러리 — 다중 슬롯 저장

- Status: Accepted (extends [ADR 0020](0020-save-and-share.md))
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

Save & Share([ADR 0020](0020-save-and-share.md))는 **단일** 자동저장(`cidrunner-design`)
+ URL/JSON 공유만 제공했다. 여러 설계를 오가며 만들려면 매번 JSON을 내보냈다 불러와야 했다.
Sprint D 목표는 서버 없이 로컬에서 **여러 설계를 이름 붙여 저장·재열기**하는 갤러리다.

## Decision

**기존 persist 스토어에 `slots` 필드를 추가하고 슬롯 CRUD를 스토어 액션으로 노출한다.**

```ts
interface GallerySlot {
  id: string           // `s-${Date.now().toString(36)}-${seq}` — 동일 ms 충돌 방지
  name: string
  snapshot: DesignSnapshot   // ADR 0020과 동일한 버전 스냅샷 {v,nodes,edges,m?}
  createdAt: number
  updatedAt: number
}
```

- 액션: `saveSlot(name)`(현재 캔버스 → 새 슬롯, 최신순 prepend), `loadSlot(id)`,
  `deleteSlot(id)`, `renameSlot(id, name)`.
- **슬롯은 공유와 같은 스냅샷 형태**라 `loadSlot`은 반드시 `sanitizeSnapshot`을 다시 통과시킨다
  — 구 스키마·수기 편집된 localStorage도 공유 URL과 **동일한 화이트리스트**로 재구성되어
  임의 필드를 스토어에 주입할 수 없다([ADR 0023](0023-editor-fundamentals.md) 정합).
- **썸네일은 저장하지 않는다.** 갤러리 카드는 슬롯 스냅샷의 노드 위치에서 **순수 SVG로 즉석
  렌더**(`src/graph/thumbnail.ts`): 부모 체인을 절대 좌표로 접고 300×200 viewBox에 종횡비 유지·
  중앙 정렬해 카테고리색 박스로 그린다(컨테이너는 외곽선, 리프는 채움). canvas 캡처·이미지
  저장이 없어 localStorage가 커지지 않고 스토어가 항상 최신 상태를 반영한다.
- UI: 툴바 이미지 아이콘 → lazy-load 모달(`Gallery.tsx`) 카드 그리드. 카드 본문 클릭=불러오기,
  이름변경·삭제 버튼, 상단 "현재 설계 저장"(이름 prompt).
- **backward-compat**: persist 버전은 그대로(1). `slots`는 partialize에 추가되며, 구 payload에
  `slots`가 없으면 merge에서 기본값 `[]`로 채워진다 — 버전 미변경이라 기존 저장 설계가 폐기되지
  않는다.

## Consequences

- **좋은 점**: 서버·계정 없이 여러 설계를 로컬에 축적. 스냅샷 형태 재사용으로 로드 경로가 공유와
  동일한 보안 게이트를 탄다. 썸네일 즉석 렌더라 저장 비용 0, stale 없음.
- **나쁜 점 / 한계**: localStorage 스코프라 **브라우저·기기 간 동기화 없음**(공유 URL/JSON로만
  이동). 용량 한도(≈5 MB)에 슬롯 수가 묶인다 — 대량 슬롯 시 정리 UX가 필요할 수 있다. 썸네일은
  노드 **위치**만 반영하고 엣지는 그리지 않는다(미니맵 목적상 충분하다는 판단).
- **후속 영향**: 필요 시 슬롯 export/import(다중 JSON), 정렬·검색(Sprint E 검색과 합류),
  용량 경고를 붙일 수 있다.
