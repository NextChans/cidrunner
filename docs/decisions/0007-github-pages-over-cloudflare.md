# 0007. 배포 대상을 Cloudflare Pages에서 GitHub Pages로 변경

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

[ADR 0006](0006-ci-cd-workflow-split.md)에서 CI(검증)와 Deploy(배포)를 두
워크플로로 분리하고, 배포 대상은 Cloudflare Pages로 두되 시크릿
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) 존재 여부로 게이팅했다. 정책
자체(CI/Deploy 분리)는 잘 동작했으나, **배포 대상**으로서 Cloudflare Pages는
이 프로젝트에 오버헤드가 컸다:

1. **시크릿 2개가 필요하다.** API 토큰과 Account ID를 별도로 발급·등록해야
   실제 배포가 돈다. 등록 전까지 배포는 영원히 skip 상태다.
2. **GitHub 밖의 별도 계정·프로젝트에 의존한다.** Cloudflare 계정을 만들고
   `cidrunner` Pages 프로젝트를 붙여야 한다. GitHub 하나로 끝나지 않는다.
3. **edge CDN 이점이 미미하다.** 개인 오픈소스 저트래픽 SPA라 Cloudflare의
   글로벌 edge locations·매우 관대한 free tier가 실질 이득을 주지 않는다.

즉, "무료 정적 SPA 호스팅" 하나만 필요한데 그 대가로 시크릿 관리와 외부 계정
의존을 떠안는 구조였다.

## Decision

배포 대상을 **GitHub Pages**로 변경한다. 공식 액션
[`actions/deploy-pages@v4`](https://github.com/actions/deploy-pages)와
`actions/upload-pages-artifact@v3`를 사용해, `build` job이 `dist`를 아티팩트로
올리고 `deploy` job이 이를 Pages에 게시한다. 인증은 OIDC(`id-token: write`)로
처리하므로 **저장소 시크릿이 0개**다.

Vite `base`를 프로덕션에서 `'/cidrunner/'`로 설정해 subpath 배포에 맞춘다
(로컬 dev는 `'/'` 유지). 결과 URL은 `https://nextchans.github.io/cidrunner/`.

**ADR 0006의 CI/Deploy 분리 정책은 그대로 유지한다.** 이 결정은 Deploy의
*대상*만 Cloudflare → GitHub Pages로 바꾼 것이며, 0006을 supersede하지 않는다.

## Consequences

- **좋은 점**: 시크릿 0개. GitHub 내부에서 완결(별도 계정·프로젝트 불필요).
  `main` push 시 자동 배포되며, 게이팅 로직이 사라져 워크플로가 단순해졌다.
  배포 안정성이 높다(공식 first-party 액션).
- **나쁜 점 / 유의점**: subpath(`/cidrunner/`) 배포이므로 client-side 라우팅을
  도입하면 base path를 반드시 고려해야 한다. Cloudflare의 edge locations와
  관대한 free tier 이점은 포기한다 — 트래픽이 커지면 언제든 재이관 가능.
- **후속 영향**: 최초 1회 저장소 **Settings → Pages → Source: GitHub Actions**를
  켜야 한다(README에 절차 명시). 그 전까지는 `deploy` job이 실패할 수 있다.
  Custom domain은 후속 과제 — `public/CNAME` 파일 추가로 지원 가능하다.
