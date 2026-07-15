# 0065. 강사용 커스텀 미션 — 데이터로 만들고 URL로 배포

- Status: Accepted
- Date: 2026-07-10
- Deciders: 차니, Claude

## Context

미션은 지금까지 전부 코드로 하드코딩됐다(14종). 하지만 별점 채점은 이미
`liveChain`(구조적 체인 매칭, ADR 0047/0041)으로 **데이터 주도**가 됐다 — 미션의
본질은 "어떤 리소스 체인이 라이브로 흘러야 하는가"라는 데이터다. 강사가 코드 배포
없이 자신만의 미션(제목·목표·힌트·필수 체인)을 만들어 학생에게 나눠줄 수 있으면
cidrunner가 교육 도구로 확장된다(김하영 최소 스펙 · 다음 스텝 투표 1위).

## Decision

**커스텀 미션을 `CustomMissionSpec` 데이터로 정의하고 `#m=` URL로 배포한다.**

- **스펙**(`missions/custom.ts`): `{title, goal, hint?, chain: ResourceType[][],
  requiredResources?, budget?}`. `chain`은 liveChain 패턴(각 단계 = 허용 타입 집합).
- **제네릭 별점 루브릭**(모든 빌트인과 동일): `toMission(spec)`가 ★1 라이브 체인
  성립 · ★2 +설정/그래프 오류 0 · ★3 +보안 경고 0(`scopedSecurityOk`)로 채점하는
  런타임 `Mission`을 만든다. 코드 미배포.
- **배포**: `encodeCustomMissionUrl`/`customMissionFromHash`가 base64url(`#g=`와
  공유하는 `graph/base64url.ts`)로 스펙을 URL 프래그먼트에 싣는다. `#m=` 링크를 열면
  App이 스펙을 `sanitizeCustomMission`(화이트리스트 재구축 — 신뢰 불가 URL)으로
  검증 후 `setCustomMission` → 챌린지 모드 활성화. **캔버스는 건드리지 않는다**(학생이
  직접 빌드). 스펙은 persist돼 새로고침에도 유지.
- **UI**: MissionPanel 상단 "나만의 미션 만들기" → lazy `CreateMission` 모달(제목/목표/
  힌트/예산 + 체인 빌더: 리소스 타입 단계 추가·삭제). "이 미션으로 시작"(로컬 활성화)
  또는 "공유 링크 복사". 활성 커스텀 미션은 빌트인들과 함께 라이브 채점되며 `커스텀`
  배지로 구분.
- v1은 단계당 단일 타입(스펙은 `ResourceType[][]`이라 대안 타입 확장은 무마이그레이션).

부수 수정: 공유 `#g=` 로드가 `loadDesign`에 `securityGroups`를 안 넘겨 SG 컬렉션이
유실되던 잠복 버그(ADR 0059 회귀)도 함께 고쳤다.

## Consequences

- **좋은 점**: 강사가 코드/배포 없이 미션을 저작·배포 → 교실 도구화. 채점은 검증된
  순수 함수 재사용이라 신규 코드 최소. `#m=`는 `#g=`(설계)와 직교라 조합 가능.
- **나쁜 점 / 한계**: 커스텀 미션은 한 번에 하나만 활성(단일 슬롯), best-star는
  빌트인만 기록(커스텀은 세션 채점만). 단계당 단일 타입(대안은 후속). 설계+미션을
  한 링크로 묶는 건 아직 별도(두 프래그먼트).
- **후속**: 대안 타입 체인 빌더 UI, 설계+미션 합본 링크, 커스텀 미션 갤러리.
