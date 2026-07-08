# 0020. Save & Share — localStorage 자동저장과 URL 공유

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude (제품 미팅 [2026-07-08](../meetings/2026-07-08-product-direction.md))

## Context

v2까지 상태는 메모리 전용이었다 — 새로고침 한 번에 작업이 증발하고, 만든 설계를
남에게 보여줄 방법이 스크린샷뿐이었다. 제품 미팅에서 4인 전원이 이를 최우선
결핍으로 지목했다. 제약: 정적 호스팅(GitHub Pages, 백엔드 없음)을 유지한다.

## Decision

**둘 다 클라이언트에서 해결한다.**

1. **자동저장** — zustand `persist` 미들웨어로 localStorage에 저장
   (키 `cidrunner-design`, `version: 1` + 마이그레이션 훅). `partialize`로
   **내구 상태만** 저장한다: `nodes`/`edges`/`mode`/`activeMissionId`.
   선택·알림·드로어·시뮬레이션 같은 transient UI는 항상 새로 시작한다.
   rehydrate/import 시 노드 id 접미사 최댓값으로 `nodeSeq`를 재시드해 복원된
   설계에서 id 충돌이 나지 않게 한다.
2. **공유** — 설계를 버전 있는 JSON 스냅샷(`{v:1, nodes, edges}`)으로 직렬화해
   (a) `#g=<base64url>` URL 프래그먼트로, (b) 다운로드 가능한 `.json` 파일로
   나른다. 프래그먼트는 서버로 전송되지 않으므로 정적 호스팅이 유지된다.
   부팅 시 해시가 있으면 자동저장보다 우선 로드하고 해시를 지운다(새로고침 시
   재임포트 방지).
3. **불신 입력 방어** — 들어오는 JSON은 `sanitizeSnapshot`이 **화이트리스트
   필드로 노드/엣지를 재조립**한다: 알 수 없는 리소스 타입·중복 id·허공을 가리키는
   parent/edge는 거부, 낯선 프로퍼티는 버린다. 외부 JSON이 스토어에 임의 속성을
   주입할 수 없다.
4. 성공 피드백을 위해 notice가 `{text, kind: 'error'|'info'}`로 확장됐다
   (복사됨/불러옴 = 초록, 거부 = 빨강).

## Consequences

- **좋은 점**: 새로고침 생존(리텐션), 링크 하나로 설계 공유(바이럴·과제 제출),
  백엔드·운영비 0 유지. 미션 별점은 그래프에서 실시간 계산되므로 그래프 복원만으로
  함께 복원된다.
- **나쁜 점 / 한계**: URL 길이는 그래프 크기에 비례한다(압축 없이 중형 설계 ~1.3KB
  — 실용 범위). 기기 간 동기화·협업 편집은 안 된다(계정 보류 결정과 일관).
  localStorage는 브라우저 데이터 삭제에 취약하다 — JSON 내보내기가 백업 수단이다.
- **후속 영향**: 저장 스키마를 바꾸면 `version`을 올리고 `migrate`를 구현한다.
  그래프가 커져 URL이 부담되면 압축(lz-string)을 그때 추가한다.
