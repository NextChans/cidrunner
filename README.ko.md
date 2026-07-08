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

> [!WARNING]
> **상태: 초기 개발 중 — 아직 사용할 수 없습니다.**
> 지금은 **Phase 0**로, 스캐폴딩과 스켈레톤 UI만 있습니다. 시뮬레이션,
> 속성 편집, Terraform 생성은 아직 동작하지 않습니다. 로드맵을 참고하세요.

## 문서

설계와 결정은 [`docs/`](docs/)에 정리되어 있습니다:

- [아키텍처](docs/ARCHITECTURE.md) — 시스템 개요, 컴포넌트, 데이터 흐름
- [Phases](docs/PHASES.md) — 완료 기준과 현재 상태가 담긴 로드맵
- [결정 기록 (ADR)](docs/decisions/) — 설계 트레이드오프와 그 근거
- [기여 가이드](docs/CONTRIBUTING.md) — 문서 · 커밋 규칙

## 컨셉

- **블록형 에디터** — AWS 리소스를 드래그 가능한 노드로 다루는 React Flow 캔버스.
- **트래픽 시뮬레이션** — Start를 누르면 요청 경로를 따라 파티클이 흐르고 병목이 하이라이트됩니다.
- **미션 & 자유 모드** — 가이드 챌린지(튜토리얼 / 3-tier / 서버리스) 또는 자유 샌드박스.
- **Terraform 내보내기** — `terraform validate` 통과를 목표로 하는 `main.tf` + `variables.tf` zip 다운로드.
- **MVP 리소스 10종** — VPC · Subnet · IGW · NAT · Security Group · ALB · EC2 · RDS · S3 · Lambda+API GW.

## 로드맵

| Phase | 범위 | 상태 |
| ----- | ---- | ---- |
| **Phase 0** | 스캐폴딩 + 스켈레톤 UI (레이아웃, 팔레트, 캔버스, 스토어) | ✅ 현재 |
| **Phase 1** | 팔레트 드래그앤드롭, 노드 중첩, 엣지 연결 규칙 | ⬜ 예정 |
| **Phase 2** | 리소스별 Inspector 속성 편집 | ⬜ 예정 |
| **Phase 3** | 트래픽 시뮬레이션 + 미션 검증 | ⬜ 예정 |
| **Phase 4** | Terraform 생성 + zip 내보내기 | ⬜ 예정 |
| **Phase 5** | 마감 다듬기, 공유, 리소스·미션 추가 | ⬜ 예정 |

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

## 배포 (Cloudflare Pages)

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)에 `main` 브랜치
push마다 빌드 후 Cloudflare Pages로 배포하는 CI가 구성되어 있습니다.

활성화하려면 저장소 시크릿을 등록하세요
(**Settings → Secrets and variables → Actions**):

| 시크릿 | 위치 |
| ------ | ---- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare 대시보드 → My Profile → API Tokens (*Cloudflare Pages: Edit* 템플릿 사용) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 대시보드 → Workers & Pages → Account ID |

그다음 **`cidrunner`**라는 이름의 Pages 프로젝트를 한 번 생성하거나, 첫
배포가 자동으로 생성하도록 두면 됩니다. 빌드 산출물 디렉토리는 `dist`입니다.

> 대시보드 연동을 선호한다면, Cloudflare Pages 대시보드에서 이 저장소를 직접
> 연결하고 빌드 명령 `npm run build`, 출력 디렉토리 `dist`로 설정한 뒤 워크플로
> 파일을 삭제해도 됩니다.

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
