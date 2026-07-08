# 0006. CI/Deploy 워크플로 분리 및 배포 시크릿 게이팅

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

Phase 0 스캐폴딩 이후 첫 push부터 GitHub Actions가 연속 실패했다. 원인은 두
가지 층위였다:

1. **직접 원인.** `.github/workflows/deploy.yml`의 `npm ci` 단계가
   `package-lock.json`이 `package.json`과 동기화되지 않아 실패했다. 로컬
   (macOS/arm64)에서 생성된 lockfile이 불완전해 Linux 러너가 필요로 하는
   플랫폼별 optional dependency(`@rolldown/binding-linux-x64-gnu`,
   `@rolldown/binding-wasm32-wasi` 및 그 전이 의존인 `@emnapi/*`)가 기록되지
   않았다. Vite 8이 rolldown 기반이라 네이티브 바인딩이 플랫폼마다 갈린다.
   → `npm ci`는 배포 단계에 도달하기도 전에 죽었다.

2. **구조적 원인.** 단일 워크플로가 build 검증과 Cloudflare 배포를 한 job에
   묶고 있었다. 배포에 필요한 시크릿(`CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID`)이 아직 등록되지 않은 상태라, 설령 `npm ci`가
   통과했더라도 매 push마다 배포가 실패했을 것이다. CI(검증)와 Deploy(배포)의
   관심사가 섞여 있어, 시크릿 부재가 build 검증까지 빨간불로 만든다.

## Decision

**lockfile을 재생성**해 모든 플랫폼의 optional dependency를 포함시켰다
(`rm -rf node_modules package-lock.json && npm install`). 이후 `npm ci`가
Linux에서도 재현 가능하게 통과한다.

워크플로를 **두 개로 분리**한다:

- **`ci.yml`** — `push`(main) + 모든 `pull_request`에서 항상 실행. checkout →
  `npm ci` → `npm run lint` → `npm run build`(= `tsc -b && vite build`)로
  타입체크와 프로덕션 빌드를 검증한다. 시크릿을 전혀 요구하지 않는다.
- **`deploy.yml`** — `push`(main) + `workflow_dispatch`에서 실행하되, 배포를
  **시크릿 존재 여부로 게이팅**한다. 시크릿은 job/step `if:` 조건에서 직접
  참조할 수 없으므로, 별도 step에서 env로 주입한 뒤 shell로 존재를 확인해
  `skip` output을 만들고, 실제 `cloudflare/wrangler-action` step은
  `if: steps.cf.outputs.skip != 'true'`로 조건 실행한다. 시크릿이 없으면
  `::warning::`만 남기고 job은 **성공**으로 끝난다.

## Consequences

- **좋은 점**: 시크릿이 없어도 CI(build/lint/타입체크)는 초록불을 유지한다.
  배포 실패가 더 이상 코드 검증 신호를 오염시키지 않는다. 시크릿 2개를 등록하는
  즉시 `deploy.yml`이 자동으로 실제 배포를 수행한다(워크플로 수정 불필요).
- **나쁜 점**: build 단계가 두 워크플로에 중복된다(각자 `npm ci` + build). push
  1회당 빌드가 두 번 돈다. 규모가 작아 감수하지만, 추후 배포를 태그/수동
  트리거로만 낮추면 중복을 없앨 수 있다.
- **후속 영향**: lockfile은 이제 다중 플랫폼 바인딩을 포함하므로, 의존성 추가
  시 반드시 `npm install` 결과 lockfile을 함께 커밋해야 CI가 깨지지 않는다.
  Cloudflare 시크릿 등록 절차는 README 양쪽 "Deployment" 절에 명시했다.
