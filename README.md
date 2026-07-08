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
> **Status: early development — not usable yet.**
> This is **Phase 0**: scaffolding and a skeleton UI only. There is no working
> simulation, property editing, or Terraform generation yet. See the roadmap.

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

## Roadmap

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **Phase 0** | Scaffolding + skeleton UI (layout, palette, canvas, store) | ✅ current |
| **Phase 1** | Drag-and-drop from palette, node nesting, edge rules | ⬜ planned |
| **Phase 2** | Inspector property editing per resource | ⬜ planned |
| **Phase 3** | Traffic simulation + mission validation | ⬜ planned |
| **Phase 4** | Terraform generation + zip export | ⬜ planned |
| **Phase 5** | Polish, sharing, more resources & missions | ⬜ planned |

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

## Deployment (Cloudflare Pages)

CI is configured in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
to build and deploy to Cloudflare Pages on every push to `main`.

To enable it, add these repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Where to find it |
| ------ | ---------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens (use the *Cloudflare Pages: Edit* template) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID |

Then create a Pages project named **`cidrunner`** once (or let the first
deploy create it). Build output directory is `dist`.

> Prefer the dashboard integration? You can instead connect this repo directly
> in the Cloudflare Pages dashboard with build command `npm run build` and
> output directory `dist`, and delete the workflow file.

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
