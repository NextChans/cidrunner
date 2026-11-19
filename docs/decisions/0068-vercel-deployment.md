# 0068. Vercel 배포 추가 — GitHub Pages와 병행

- Status: Accepted
- Date: 2026-11-19
- Deciders: 차니, Claude

## Context

현재 배포는 GitHub Pages(ADR 0007)로, `https://nextchans.github.io/cidrunner/`
하위 경로에서 서비스된다. PR마다 확인할 수 있는 프리뷰 URL과 도메인 루트 서비스가
필요해 Vercel 배포를 추가한다.

## Decision

- **Vercel Git 연동**으로 배포한다. Vercel이 저장소를 직접 감시해 `main` push는
  프로덕션, PR은 프리뷰 URL로 배포한다. GitHub Actions에 Vercel 토큰 같은
  시크릿을 둘 필요가 없다.
- 빌드 설정은 `vercel.json`에 코드로 둔다(`npm ci` → `npm run build` → `dist`).
  해시가 붙은 `/assets/*`는 1년 immutable 캐시, 그 외 경로에는 기본 보안 헤더를 붙인다.
- `vite.config.ts`의 `base`는 Vercel 빌드(`VERCEL=1`)에서만 `/`, 그 외
  프로덕션 빌드에서는 기존처럼 `/cidrunner/`로 둔다.
- GitHub Pages 워크플로(`deploy.yml`)는 당분간 유지한다(병행 운영).

## Consequences

- **좋은 점**: PR 프리뷰 배포, 시크릿 없는 배포, GitHub Pages 회귀 없음.
- **나쁜 점 / 한계**: 프로젝트 import는 Vercel 대시보드에서 한 번 수동으로 해야 한다.
  `index.html`의 OG 메타 URL과 Terraform 내보내기 헤더는 아직 GitHub Pages
  주소를 가리킨다. Vercel을 정식 주소로 삼게 되면 함께 바꾸고, Pages 워크플로를
  정리할지 결정한다.
