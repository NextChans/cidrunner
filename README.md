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

> [!WARNING]
> **Status: early development.**
> Through **Phase 2**: you can build a topology (drag-and-drop from the palette,
> nest resources, wire rule-checked edges) and edit each resource's properties
> with real-time validation. Traffic simulation and Terraform generation are not
> in yet. See the roadmap.

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

- **Block-style editor** — a React Flow canvas where AWS resources are draggable nodes.
- **Traffic simulation** — press Start and animated particles trace the request path; bottlenecks highlight.
- **Missions & Free mode** — guided challenges (tutorial / 3-tier / serverless) or an open sandbox.
- **Terraform export** — download a `main.tf` + `variables.tf` zip that aims to pass `terraform validate`.
- **MVP resource set (10)** — VPC · Subnet · IGW · NAT · Security Group · ALB · EC2 · RDS · S3 · Lambda+API GW.
- **Mobile** — building infra is a desktop-first experience, but narrow screens (<768px) get a full-viewport canvas with the palette / inspector / missions moved into overlay drawers, so a project stays viewable and demo-able on a phone. See [ADR 0009](docs/decisions/0009-mobile-responsive-drawer-pattern.md).

## Roadmap

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **Phase 0** | Scaffolding + skeleton UI (layout, palette, canvas, store) | ✅ done |
| **Phase 1** | Drag-and-drop from palette, node nesting, edge rules | ✅ done |
| **Phase 2** | Inspector property editing per resource | ✅ current |
| **Phase 3** | Traffic simulation | ⬜ planned |
| **Phase 4** | Terraform generation + zip export | ⬜ planned |
| **Phase 5** | Mission system (clear detection + star rating) | ⬜ planned |

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
├─ resources/              # 10 resource metas + registry (terraform emitters stubbed)
└─ missions/               # tutorial / 3-tier / serverless
```

## License

[MIT](LICENSE) © NextChans
