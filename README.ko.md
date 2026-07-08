<div align="right">

[English](README.md) | [한국어](README.ko.md)

</div>

# 🎮 cidrunner

> Terraform으로 내보내는 AWS 인프라 블록 게임.

**cidrunner**는 클라우드 아키텍처를 퍼즐 게임으로 바꿉니다. 리소스 블록을
캔버스에 끌어다 놓고 서로 연결한 뒤 **Start**를 누르면, 트래픽 파티클이
`클라이언트 → 로드밸런서 → 앱 → 데이터베이스`로 흐릅니다. 경로가 막히면
막은 리소스가 하이라이트됩니다. 가이드 미션을 클리어하거나 자유롭게
설계한 뒤, 완성한 구성을 바로 실행 가능한 Terraform으로 **내보낼** 수 있습니다.

> [!NOTE]
> **상태: v2 — AWS 엔지니어 시뮬레이션.**
> 카테고리 팔레트로 토폴로지를 구성하고, 리소스 이름·필수 속성을 2단계 실시간
> 검증(빨강 오류 / 주황 보안 경고)과 함께 편집합니다. **Security Group은 엣지로
> 연결**하고, **시작**을 누르면 모든 트래픽 플로우가 파티클·도착 펄스로
> 재생됩니다. 베스트 프랙티스 **미션**(시큐리티 하드닝 포함)을 클리어하고,
> **apply 가능한 Terraform**을 내려받아 `terraform apply` 하면 실제 리소스가
> 생성됩니다.

> [!NOTE]
> **UI 언어: 한국어.** 앱 내 UI는 한국어입니다(하드코딩, i18n 프레임워크 없음).
> AWS 리소스명·기술 용어는 원어(영문)로 유지됩니다.
> [ADR 0008](docs/decisions/0008-korean-first-ui-no-i18n.md) 참고.

## 문서

설계와 결정은 [`docs/`](docs/)에 정리되어 있습니다:

- [아키텍처](docs/ARCHITECTURE.md) — 시스템 개요, 컴포넌트, 데이터 흐름
- [Phases](docs/PHASES.md) — 완료 기준과 현재 상태가 담긴 로드맵
- [결정 기록 (ADR)](docs/decisions/) — 설계 트레이드오프와 그 근거
- [기여 가이드](docs/CONTRIBUTING.md) — 문서 · 커밋 규칙

## 컨셉

- **블록형 에디터** — 카테고리(네트워킹/컴퓨팅/데이터베이스/스토리지/보안)로 정리된 팔레트와 실제 AWS 규칙을 따르는 중첩·연결.
- **보안이 곧 게임** — Security Group을 엣지로 그려서 연결하고, 암호화·퍼블릭 차단 토글을 다룹니다. 위험한 구성은 주황 경고로 표시됩니다.
- **트래픽 재생** — Start를 누르면 모든 플로우(ALB → EC2 → RDS, Lambda → S3 …)가 파티클과 도착 펄스로 재생되고, 막힌 경로는 병목 노드가 하이라이트됩니다.
- **미션 & 자유 모드** — 베스트 프랙티스 챌린지(튜토리얼 / 고가용성 3-tier / 서버리스 / 시큐리티 하드닝)와 별점(0–3), 또는 자유 샌드박스.
- **저장 & 공유** — 설계가 브라우저에 자동 저장되어 새로고침에도 유지되고, URL 하나 또는 JSON 파일로 공유됩니다. 계정·백엔드 불필요.
- **apply 가능한 Terraform 내보내기** — 라우트 테이블·DB Subnet Group·IAM·API Gateway까지 유도 생성된 `main.tf`/`variables.tf`/`outputs.tf`. `terraform apply` 하면 실제 리소스가 생성됩니다.
- **MVP 리소스 10종** — VPC · Subnet · IGW · NAT · Security Group · ALB · EC2 · RDS · S3 · Lambda+API GW.
- **모바일** — 인프라 편집은 데스크톱 우선 경험이지만, 좁은 화면(<768px)에서는 캔버스가 전체 화면을 차지하고 팔레트 / 인스펙터 / 미션이 오버레이 drawer로 이동해 폰에서도 프로젝트를 보고 데모할 수 있습니다. [ADR 0009](docs/decisions/0009-mobile-responsive-drawer-pattern.md) 참고.

## 로드맵

| Phase | 범위 | 상태 |
| ----- | ---- | ---- |
| **Phase 0** | 스캐폴딩 + 스켈레톤 UI (레이아웃, 팔레트, 캔버스, 스토어) | ✅ 완료 |
| **Phase 1** | 팔레트 드래그앤드롭, 노드 중첩, 엣지 연결 규칙 | ✅ 완료 |
| **Phase 2** | 리소스별 Inspector 속성 편집 + 실시간 검증 | ✅ 완료 |
| **Phase 3** | 트래픽 시뮬레이션 | ✅ 완료 |
| **Phase 4** | Terraform 생성 + zip 내보내기 | ✅ 완료 |
| **Phase 5** | 미션 시스템 (클리어 판정 + 별점) | ✅ 완료 |

각 Phase의 자세한 완료 기준과 현재 상태는
[docs/PHASES.md](docs/PHASES.md)에, 이 선택들의 설계 트레이드오프는
[docs/decisions/](docs/decisions/)의 ADR에 기록되어 있습니다.

## 기술 스택

- [Vite](https://vite.dev/) + React 19 + TypeScript (strict)
- [React Flow (`@xyflow/react`)](https://reactflow.dev/) — 캔버스 & 노드
- [Zustand](https://github.com/pmndrs/zustand) — 상태 관리
- [Tailwind CSS](https://tailwindcss.com/) — 스타일링
- [Framer Motion](https://www.framer.com/motion/) — 애니메이션 (Phase 3)
- [JSZip](https://stuk.github.io/jszip/) — 내보내기 (Phase 4)
- [lucide-react](https://lucide.dev/) — 아이콘

## 요구사항

- Node.js 20+
- npm 10+

## 시작하기

```bash
npm install
npm run dev      # http://localhost:5173
```

기타 스크립트:

```bash
npm run build    # 타입 체크 + 프로덕션 빌드 → dist/
npm run preview  # 프로덕션 빌드 로컬 서빙
npm run lint     # oxlint
```

## CI & 배포

GitHub Actions 워크플로가 두 개로 나뉘어 있습니다
(자세한 근거는 [ADR 0006](docs/decisions/0006-ci-cd-workflow-split.md),
[ADR 0007](docs/decisions/0007-github-pages-over-cloudflare.md)):

- **[`ci.yml`](.github/workflows/ci.yml)** — `main` push와 모든 pull request에서
  실행. 의존성 설치 → lint → 타입체크 → 빌드를 수행합니다. **시크릿이 전혀
  필요 없습니다.**
- **[`deploy.yml`](.github/workflows/deploy.yml)** — `main` push(및 수동 실행)에서
  `actions/deploy-pages@v4`로 **GitHub Pages**에 배포합니다. 인증은 OIDC로
  처리하므로 이쪽도 **시크릿이 필요 없습니다.**

배포 URL은 **https://nextchans.github.io/cidrunner/** 입니다. Vite는 프로덕션
빌드에서 `base: '/cidrunner/'`로 설정되어 있고([`vite.config.ts`](vite.config.ts)),
로컬 `npm run dev`는 `/` 그대로 유지됩니다.

**최초 1회 설정.** GitHub Pages의 소스를 Actions로 한 번 바꿔줘야 합니다:

1. 저장소 → **Settings → Pages**.
2. **Build and deployment → Source**에서 **GitHub Actions**를 선택합니다
   ("Deploy from a branch" 방식 아님).
3. `main`에 push(또는 Deploy 워크플로 수동 실행)합니다. 첫 run이 성공하면
   `https://nextchans.github.io/cidrunner/` 에서 사이트가 열립니다.

> Pages 소스를 GitHub Actions로 바꾸기 전에는 첫 `deploy` job이 실패할 수
> 있습니다 — 정상입니다. build job은 소스와 무관하게 프로덕션 번들을 계속
> 검증합니다.

## 프로젝트 구조

```
src/
├─ store/useGraphStore.ts   # Zustand — nodes / edges / mode
├─ components/              # Layout, Canvas, Palette, Inspector, MissionPanel, Toolbar
│  └─ nodes/ResourceNode.tsx
├─ resources/              # 리소스 10종 meta + 레지스트리 (terraform 생성기는 스텁)
└─ missions/               # 튜토리얼 / 3-tier / 서버리스
```

## 라이선스

[MIT](LICENSE) © NextChans
