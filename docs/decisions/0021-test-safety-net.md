# 0021. Test safety net for graph modules

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude (제품 미팅 [2026-07-08](../meetings/2026-07-08-product-direction.md))

## Context

CI는 lint+build뿐이었고 테스트 러너가 없었다. 그런데 제품의 핵심 자산 —
`src/graph/terraform.ts`(apply하면 실제 과금되는 코드 생성), `checks.ts`(오류/보안
경고), `simulate.ts`, `cidr.ts`, `rules.ts`, `share.ts` — 은 전부 순수 함수라
테스트 비용이 가장 낮은 코드다. 리소스를 추가·수정할 때마다 export 회귀를 사람
눈으로만 잡는 상태였다.

## Decision

**Vitest를 도입하고 `src/graph/*`를 단위 테스트로 고정한다.** UI(React
컴포넌트) 테스트는 이번 범위가 아니다 — 위험 대비 비용이 가장 좋은 곳부터.

- 테스트는 `src/graph/__tests__/`에 두고, 공용 픽스처(`helpers.ts`)의
  베스트 프랙티스 토폴로지를 스위트 간 재사용한다.
- 고정하는 계약: 시뮬레이션 멀티 플로우·차단 판정·비트래픽 엣지(SG/복제) 제외,
  CIDR 파싱·포함·중첩, 오류/경고 규칙 각각, Terraform 생성물의 파생 배관
  (라우트 테이블·DB 서브넷 그룹·IAM·타깃 어태치먼트)과 복제본 형태, 공유
  스냅샷의 왕복·불신 입력 거부.
- CI(`ci.yml`)에 `npm test` 스텝을 lint와 build 사이에 추가 — 모든 push/PR에서
  실행된다.

## Consequences

- **좋은 점**: "리소스 하나 고쳤더니 export가 조용히 깨지는" 부류의 회귀가 CI에서
  잡힌다. 이후 리소스 확장(보류 중)의 전제 조건이 마련됐다.
- **나쁜 점 / 한계**: 실제 `terraform validate`는 CI에서 돌리지 않는다(바이너리
  다운로드·초기화 비용) — 생성물의 구조적 계약만 고정하고, validate는 릴리스 전
  수동 확인으로 남는다. UI 회귀는 여전히 수동(Playwright 스크립트는 레포 밖).
- **후속 영향**: 새 graph 모듈·리소스 추가 시 테스트를 같은 PR에 추가하는 것을
  리뷰 체크포인트로 삼는다. UI 테스트가 필요해지면 별도 ADR로.
