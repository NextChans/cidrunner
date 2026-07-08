# 0004. Tech stack

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

프론트엔드 스택을 확정해야 했다. 검토 축은 다음과 같다: 빌드/프레임워크
(Vite SPA vs Next.js), 상태 관리(Zustand vs Redux vs Jotai), 스타일링
(styled-components vs Tailwind), SSR 필요성, 상태 크기와 boilerplate 비용.
cidrunner는 서버가 없는 순수 클라이언트 편집기이고 SEO/SSR이 불필요하다.

## Decision

다음 스택으로 확정한다:

- **Vite + React 19 + TypeScript(strict)** — SPA 빌드
- **React Flow (`@xyflow/react`)** — 캔버스/노드 ([ADR 0002](0002-react-flow-over-blockly.md))
- **Zustand** — 상태 관리
- **Tailwind CSS v3** — 스타일링
- **Framer Motion** — 애니메이션 (Phase 3)
- **JSZip** — export (Phase 4)
- **lucide-react** — 아이콘

## Consequences

- **좋은 점**: SSR이 불필요하므로 SPA로 충분하고, Cloudflare Pages에 무료
  정적 호스팅이 가능하다. Zustand는 상태 크기가 적당한 이 규모에 맞고
  boilerplate가 최소다. React 19로 최신을 유지한다.
- **나쁜 점 / 주의**: Tailwind는 **v3에 핀** 한다 — v4는 플러그인/설정 방식이
  달라 PostCSS 구성이 바뀌므로 지금 올리지 않는다.
- **후속 영향**: 서버가 없으므로 시뮬레이션·Terraform 생성 전부 브라우저에서
  실행된다([ADR 0005](0005-terraform-generation-approach.md)). 상태가 크게
  늘면 Zustand 재평가가 필요할 수 있다.
