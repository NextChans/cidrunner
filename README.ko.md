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
> AWS 리소스명·기술 용어는 원어(영문)로 유지됩니다. Sprint D에서 재검토 후 유지 결정 —
> [ADR 0008](docs/decisions/0008-korean-first-ui-no-i18n.md)과 재검토
> [ADR 0034](docs/decisions/0034-i18n-defer.md) 참고. **국제화 로드맵:** 비한국어권 수요
> (예: 별 100개 이상, 영어권 이슈/PR 유입)가 관측되면 영문 UI 도입을 재고합니다. 이 README는
> 이미 이중언어라 국제 방문자도 개요·실행 방법은 이해할 수 있습니다.

## 문서

설계와 결정은 [`docs/`](docs/)에 정리되어 있습니다:

- [아키텍처](docs/ARCHITECTURE.md) — 시스템 개요, 컴포넌트, 데이터 흐름
- [Phases](docs/PHASES.md) — 완료 기준과 현재 상태가 담긴 로드맵
- [결정 기록 (ADR)](docs/decisions/) — 설계 트레이드오프와 그 근거
- [기여 가이드](docs/CONTRIBUTING.md) — 문서 · 커밋 규칙

## 컨셉

- **블록형 에디터** — 카테고리(네트워킹/컴퓨팅/데이터베이스/스토리지/앱 통합/관리·모니터링/보안·아이덴티티)로 정리된 팔레트와 실제 AWS 규칙을 따르는 중첩·연결. 상단 검색으로 실시간 필터(debounce), `/` 키로 포커스. [ADR 0037](docs/decisions/0037-palette-search.md) 참고.
- **보안이 곧 게임** — Security Group을 엣지로 그려서 연결하고, 암호화·퍼블릭 차단 토글을 다룹니다. 위험한 구성은 주황 경고로 표시됩니다.
- **트래픽 재생** — Start를 누르면 모든 플로우(ALB → EC2 → RDS, Lambda → S3 …)가 파티클과 도착 펄스로 재생되고, 막힌 경로는 병목 노드가 하이라이트됩니다.
- **미션 & 자유 모드** — 베스트 프랙티스 챌린지 12종(튜토리얼 / 고가용성 3-tier / 서버리스 / 글로벌 정적 웹 / 비동기 파이프라인 / 컨테이너 워크로드 / 글로벌 동적 웹 / 이벤트 드리븐 팬아웃 / 시큐리티 하드닝 / 재난 복구 / 데이터 파이프라인 / 보안·인증 웹)과 별점(0–3), 또는 자유 샌드박스.
- **저장 & 공유** — 설계가 브라우저에 자동 저장되어 새로고침에도 유지되고, URL 하나 또는 JSON 파일로 공유됩니다(미션 컨텍스트 포함, 불러오기 전 기존 작업 확인). 계정·백엔드 불필요. 공유 링크는 Open Graph·Twitter Card 미리보기 이미지를 함께 노출합니다. [ADR 0031](docs/decisions/0031-og-image-and-share-metadata.md) 참고.
- **갤러리** — 여러 설계를 이름 붙여 로컬 슬롯에 저장하고, 실시간 SVG 썸네일 카드 그리드에서 다시 엽니다. 이름 변경·삭제도 인라인으로. [ADR 0033](docs/decisions/0033-gallery-multi-slot.md) 참고.
- **배지** — 플레이 진행도에서 순수하게 파생되는 배지 5종(첫 클리어·첫 3-star·첫 저장·미션 5개·전 미션 3-star)이 열립니다. [ADR 0032](docs/decisions/0032-achievements-and-badges.md) 참고.
- **에디터 기본기** — undo/redo(Ctrl+Z, 제스처당 1스텝), 첫 방문 튜토리얼 안내, 미션별 별점 최고기록.
- **키보드 단축키 & 컨텍스트 메뉴** — undo/redo(⌘Z / ⌘⇧Z)·복제(⌘D)·삭제·화면 맞춤(R)·시뮬(S)·내보내기(E)·리소스 검색 포커스(/)·도움말(?) 전역 단축키, 노드 우클릭으로 속성 편집 / 복제 / 엣지 지우기 / 부모 분리 / 부모에 넣기 / 삭제. 노드를 컨테이너 위로 드래그하면 자동으로 중첩된다. [ADR 0028](docs/decisions/0028-keyboard-shortcuts-and-context-menu.md) · [ADR 0038](docs/decisions/0038-containment-attach-actions.md) 참고.
- **인터랙티브 튜토리얼** — 첫 미션이 실시간 자가 점검 단계 목록을 보여주며, 설계를 진행하면 완료 단계가 꺼지고 다음 할 일이 강조됩니다. [ADR 0030](docs/decisions/0030-interactive-tutorial-steps.md) 참고.
- **트래픽 재생** — 시작 시 모든 진입점을 백트래킹 탐색으로 추적(미완결 분기를 먼저 그려도 완결 경로가 있으면 도달로 판정 — [ADR 0047](docs/decisions/0047-simulate-backtracking.md)), 활성 로드 밸런서는 모든 타깃으로 라운드로빈 분산 애니메이션([ADR 0048](docs/decisions/0048-load-balancing-animation.md)), 각 엣지는 나가는/들어오는 방향 효과를 성공=녹색·차단=빨강으로 표시합니다([ADR 0049](docs/decisions/0049-edge-inout-visual-effects.md)).
- **예산 모드** — 전체 설계의 실시간 월 비용 추정(💸)을 보여주고, 미션마다 예산 목표가 있어 "싸게 만들기" 최적화 퍼즐이 됩니다(NAT Gateway·ALB·EKS 비용 함정이 즉시 드러남). [ADR 0051](docs/decisions/0051-cost-budget-mode.md) 참고.
- **apply 가능한 Terraform 내보내기** — 라우트 테이블·DB Subnet Group·IAM·Lambda에 연결된 API Gateway REST API까지 유도 생성된 `main.tf`/`variables.tf`/`outputs.tf`. `terraform apply` 하면 실제 리소스가 생성됩니다.
- **조직 박스 & 상속 디폴트** — `AWS Account ▸ VPC ▸ Availability Zone ▸ Subnet` 으로 중첩. VPC 안에 만든 Subnet은 다음 빈 `/24`를 자동 배정받고, AZ 박스 안에 만든 Subnet은 그 `az`를 물려받습니다(둘 다 변경 가능). [ADR 0050](docs/decisions/0050-account-az-containers-and-inheritance.md) 참고.
- **리소스 29종** — AWS Account · Availability Zone · VPC · Subnet · IGW · NAT · Route 53 · CloudFront · ALB · EC2 · ECS Fargate · EKS · Lambda · API Gateway · RDS(+읽기 복제본) · ElastiCache · DynamoDB · S3 · EFS · Kinesis · SQS · SNS · CloudWatch · Security Group · Cognito · Secrets Manager · KMS · ACM · WAF. [ADR 0035](docs/decisions/0035-resource-expansion-3-security-and-streaming.md) · Lambda/API GW 분리 [ADR 0046](docs/decisions/0046-lambda-apigw-split.md) · Account/AZ 박스 [ADR 0050](docs/decisions/0050-account-az-containers-and-inheritance.md) 참고.
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
├─ resources/              # 리소스 29종 meta + 레지스트리 (apply-ready terraform 생성기)
└─ missions/               # 미션 12종: 튜토리얼 / 3-tier / 서버리스 / 정적CDN / 비동기파이프라인 / 컨테이너 / 글로벌동적웹 / 이벤트드리븐 / 보안 / 재난복구 / 데이터파이프라인 / 보안인증웹
```

## 라이선스

[MIT](LICENSE) © NextChans
