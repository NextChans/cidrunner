# 0031. OG 이미지 & 소셜 공유 메타데이터

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

공유 URL(`#g=…`, [ADR 0020](0020-save-and-share.md))을 SNS·메신저(카카오톡·Slack·X 등)에
붙여넣으면 제목·설명·미리보기 이미지가 없어 밋밋한 링크로만 노출된다. Open Graph / Twitter
Card 메타태그가 없기 때문이다. Sprint D의 첫 목표는 이 미리보기를 채우는 것.

선택지는 두 가지였다.

1. **정적 OG 이미지** — 프로젝트 로고+타이틀 PNG 1장을 `public/`에 두고 head에 절대 URL로 건다.
2. **동적 OG 이미지** — 공유된 그래프를 파라미터로 받아 요청 시 canvas→PNG로 렌더.

동적 방식은 이미지를 요청 시점에 생성할 **서버(또는 Vercel/Cloudflare Functions)** 가 필요하다.
cidrunner는 GitHub Pages 정적 호스팅([ADR 0007](0007-github-pages-over-cloudflare.md))이고
공유는 프래그먼트 기반이라 서버가 없다 — 동적 OG를 하려면 배포 모델 자체를 바꿔야 한다.

## Decision

**정적 OG 이미지 1장으로 시작한다.**

- `public/og-image.png` (1200×630) — favicon과 동일한 슬레이트/에메랄드 팔레트에 네트워크
  그래프 모티프 + `cidrunner` 타이틀 + 한글 태그라인. **PIL로 결정적 생성**(스크립트는 리포에
  두지 않고 산출물 PNG만 커밋 — 34 kB). SVG가 아닌 PNG인 이유: `image/svg+xml` OG는 대부분의
  SNS 크롤러가 렌더하지 않는다.
- `index.html` `<head>`에 `og:*`(type·site_name·title·description·url·image·image:width/height
  ·image:alt·locale) + `twitter:card=summary_large_image` 태그 추가.
- 이미지·URL은 **절대 경로**(`https://nextchans.github.io/cidrunner/…`)로 명시 — 크롤러는
  상대 경로를 base(`/cidrunner/`)로 해석하지 못한다.

## Consequences

- **좋은 점**: 서버 없이 모든 공유 링크가 브랜드 미리보기를 얻는다. 산출물이 정적이라
  캐시·CDN 친화적이고 실패 지점이 없다.
- **나쁜 점 / 한계**: 미리보기가 **설계별로 다르지 않다** — 어떤 그래프를 공유하든 같은 카드가
  뜬다. 실제 SNS 렌더는 배포 후 각 플랫폼 크롤러로만 검증 가능하다(로컬에선 head 태그 존재만
  확인). 이미지 문구를 바꾸려면 PNG를 재생성해야 한다.
- **재검토 조건**: 설계별 동적 미리보기 요구가 생기면 (a) 빌드 타임에 인기 미션 프리셋 N장을
  미리 굽거나, (b) 경량 Functions(Cloudflare/Vercel)로 배포 모델을 옮겨 요청 시 렌더하는 방향으로
  이 ADR을 superseding하는 새 ADR을 연다.
