<div align="right">

[English](README.md) | [한국어](README.ko.md)

</div>

# 🎮 cidrunner

> An AWS infrastructure block game with Terraform export.

**cidrunner** turns cloud architecture into a puzzle game. Drag resource blocks
onto a canvas, wire them together, hit **Start**, and watch traffic particles
flow `client → load balancer → app → database`. If the path is broken, the
blocking resource lights up. Clear guided missions, or build freely — then
**export** your design as ready-to-run Terraform.

> [!NOTE]
> **Status: v2 — an AWS engineer simulation.**
> Build a topology from a categorized palette, name resources and edit required
> properties with two-severity real-time validation (red errors / amber security
> warnings), attach **Security Groups by drawing edges**, press **Start** to play
> back every traffic flow (particles, arrival pulses, per-flow outcomes), clear
> best-practice **missions** (including a security-hardening challenge), and
> **export apply-ready Terraform** — `terraform apply` creates the real thing.

> [!NOTE]
> **UI language: Korean.** The in-app UI is Korean (hardcoded, no i18n
> framework); AWS resource names and technical terms stay in English. See
> [ADR 0008](docs/decisions/0008-korean-first-ui-no-i18n.md).

## Documentation

Design and decisions live in [`docs/`](docs/):

- [Architecture](docs/ARCHITECTURE.md) — system overview, components, data flow
- [Phases](docs/PHASES.md) — roadmap with definitions of done and status
- [Decisions (ADRs)](docs/decisions/) — the design trade-offs and why
- [Contributing](docs/CONTRIBUTING.md) — docs & commit conventions

## Concept

- **Block-style editor** — a React Flow canvas with a categorized palette (networking / compute / database / storage / integration / management / security); resources nest and connect under real AWS rules.
- **Security as gameplay** — attach Security Groups by drawing edges; encryption and public-access toggles; amber warnings for anything insecure.
- **Traffic playback** — press Start and every flow (ALB → EC2 → RDS, Lambda → S3, …) animates with particles and arrival pulses; blocked paths highlight the blocking node.
- **Missions & Free mode** — 10 best-practice challenges (tutorial / HA 3-tier / serverless / static CDN / async pipeline / container workload / global dynamic web / event-driven fan-out / security hardening / disaster recovery) with 0–3 star ratings, or an open sandbox.
- **Save & Share** — designs autosave to the browser (survive refresh) and share as a single URL or a JSON file (mission context included, load asks before replacing your work); no account, no backend.
- **Editor fundamentals** — undo/redo (Ctrl+Z, one step per gesture), a first-visit tutorial hand-off, and per-mission best-star records.
- **Keyboard & context menu** — global shortcuts for undo/redo (⌘Z / ⌘⇧Z), duplicate (⌘D), delete, fit view (R), simulate (S), export (E), and a `?` cheat-sheet; right-click a node to edit / duplicate / clear edges / detach / delete. See [ADR 0028](docs/decisions/0028-keyboard-shortcuts-and-context-menu.md).
- **Interactive tutorial** — the first mission shows a live, self-checking step list that ticks off and highlights the next action as you build. See [ADR 0030](docs/decisions/0030-interactive-tutorial-steps.md).
- **Apply-ready Terraform export** — `main.tf`, `variables.tf`, `outputs.tf` with derived route tables, DB subnet groups, IAM, and a working API Gateway; `terraform apply` creates real resources.
- **Resource set (20)** — VPC · Subnet · IGW · NAT · Route 53 · CloudFront · ALB · EC2 · ECS Fargate · EKS · Lambda+API GW · RDS (+read replica) · ElastiCache · DynamoDB · S3 · EFS · SQS · SNS · CloudWatch · Security Group.
- **Mobile** — building infra is a desktop-first experience, but narrow screens (<768px) get a full-viewport canvas with the palette / inspector / missions moved into overlay drawers, so a project stays viewable and demo-able on a phone. See [ADR 0009](docs/decisions/0009-mobile-responsive-drawer-pattern.md).

## Roadmap

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **Phase 0** | Scaffolding + skeleton UI (layout, palette, canvas, store) | ✅ done |
| **Phase 1** | Drag-and-drop from palette, node nesting, edge rules | ✅ done |
| **Phase 2** | Inspector property editing per resource | ✅ done |
| **Phase 3** | Traffic simulation | ✅ done |
| **Phase 4** | Terraform generation + zip export | ✅ done |
| **Phase 5** | Mission system (clear detection + star rating) | ✅ done |

Detailed definitions of done and current status are in
[docs/PHASES.md](docs/PHASES.md); the design trade-offs behind these choices are
recorded as ADRs in [docs/decisions/](docs/decisions/).

## Tech stack

- [Vite](https://vite.dev/) + React 19 + TypeScript (strict)
- [React Flow (`@xyflow/react`)](https://reactflow.dev/) — canvas & nodes
- [Zustand](https://github.com/pmndrs/zustand) — state
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Framer Motion](https://www.framer.com/motion/) — animation (Phase 3)
- [JSZip](https://stuk.github.io/jszip/) — export (Phase 4)
- [lucide-react](https://lucide.dev/) — icons

## Requirements

- Node.js 20+
- npm 10+

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check + production build → dist/
npm run preview  # serve the production build locally
npm run lint     # oxlint
```

## CI & Deployment

Two GitHub Actions workflows (see
[ADR 0006](docs/decisions/0006-ci-cd-workflow-split.md) and
[ADR 0007](docs/decisions/0007-github-pages-over-cloudflare.md)):

- **[`ci.yml`](.github/workflows/ci.yml)** — runs on every push to `main` and on
  every pull request. Installs deps, lints, type-checks, and builds. **Requires
  no secrets.**
- **[`deploy.yml`](.github/workflows/deploy.yml)** — runs on push to `main` (and
  manual dispatch) and deploys to **GitHub Pages** via `actions/deploy-pages@v4`.
  Authentication is handled by OIDC, so it **requires no secrets** either.

The site is served at **https://nextchans.github.io/cidrunner/** — Vite is
configured with `base: '/cidrunner/'` for production builds
([`vite.config.ts`](vite.config.ts)), while local `npm run dev` stays at `/`.

**One-time setup.** GitHub Pages must be switched to the Actions source once:

1. Repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not the
   "Deploy from a branch" option).
3. Push to `main` (or run the Deploy workflow manually). Once the first run
   succeeds, the site is live at `https://nextchans.github.io/cidrunner/`.

> Until Pages is switched to the GitHub Actions source, the `deploy` job may
> fail on its first run — that is expected. The build job still validates the
> production bundle regardless.

## Project structure

```
src/
├─ store/useGraphStore.ts   # Zustand — nodes / edges / mode
├─ components/              # Layout, Canvas, Palette, Inspector, MissionPanel, Toolbar
│  └─ nodes/ResourceNode.tsx
├─ resources/              # 20 resource metas + registry (apply-ready terraform emitters)
└─ missions/               # 10 missions: tutorial / 3-tier / serverless / static-CDN / async-pipeline / container / global-web / event-driven / security / disaster-recovery
```

## License

[MIT](LICENSE) © NextChans
