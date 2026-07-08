# Phases

The cidrunner roadmap, broken into shippable phases. Each phase lists its
**goal**, its **Definition of Done**, its **current status**, and the ADRs /
issues that shaped it.

Status legend: ✅ done · 🚧 in progress · ⏳ planned

> **Workflow reminder.** When a phase is completed, update its status and the
> "History" note below in the same PR that lands the work. Design decisions made
> during a phase must be recorded as a new ADR under
> [`decisions/`](decisions/) — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Phase 0 — Scaffolding & skeleton UI ✅

**Goal.** Stand up the project skeleton so later phases have a home: build
tooling, state layer, and a non-functional three-pane UI.

**Definition of Done.**
- Vite + React 19 + TypeScript (strict) project builds and lints clean.
- Three-pane layout: Palette (left) · Canvas (center) · Inspector (right).
- Palette renders the 10 MVP resources.
- Mission panel renders the 3 seed missions as cards.
- Toolbar stub (mode toggle, Start/Export buttons — non-functional).
- Zustand `useGraphStore` holds nodes / edges / mode / selection.
- CI configured: a `ci.yml` build/lint/type-check gate (always runs) and a
  `deploy.yml` GitHub Pages deploy (`actions/deploy-pages@v4`, no secrets).

**Status.** ✅ Complete — scaffold shipped in `7bfbd38`; CI split and lockfile
fix followed (see ADR 0006); deploy target moved to GitHub Pages (see ADR 0007).

**Related.** [ADR 0004 — Tech stack](decisions/0004-tech-stack.md) ·
[ADR 0002 — React Flow over Blockly](decisions/0002-react-flow-over-blockly.md) ·
[ADR 0006 — CI/Deploy workflow split](decisions/0006-ci-cd-workflow-split.md) ·
[ADR 0007 — GitHub Pages over Cloudflare](decisions/0007-github-pages-over-cloudflare.md)

---

## Phase 1 — Palette drag-and-drop, nesting & edge rules ✅

**Goal.** Make the canvas editable: drag resources from the palette, nest them
correctly (VPC ▸ Subnet ▸ EC2/RDS …), and constrain edges by direction/type.

**Definition of Done.**
- ✅ Drag a resource from the palette and drop it onto the canvas to create a
  node. (Click-to-add is also supported and auto-places into a valid container.)
- ✅ Nesting works: drop a Subnet inside a VPC, and an EC2 inside a Subnet.
- ✅ Invalid parent relationships are rejected in the UI (a Subnet cannot contain
  a VPC; an EC2 cannot be a top-level orphan where a Subnet is required), with a
  transient Korean notice.
- ✅ Edges enforce direction and type constraints (ALB → EC2/Lambda,
  EC2/Lambda → RDS/S3); disallowed connections are refused with visible feedback.

**Status.** ✅ Complete — the rule model lives on `ResourceMeta`
(`allowedParents` / `container` / `connectsTo`) and is centralized in
`src/graph/rules.ts`; the canvas stays free of per-resource branching.

**Related.** [ADR 0001 — MVP scope & resource list](decisions/0001-mvp-scope-and-resource-list.md) ·
[ADR 0010 — Graph nesting & edge rule model](decisions/0010-graph-nesting-and-edge-rule-model.md)

---

## Phase 2 — Inspector property editor & validation ✅

**Goal.** Edit resource configuration and validate it in real time.

**Definition of Done.**
- ✅ Selecting a node shows a per-resource property form in the Inspector,
  generated from a data-driven `ResourceMeta.fields` descriptor.
- ✅ Each resource seeds sensible default values (`ResourceMeta.defaults`).
- ✅ Real-time validation (`ResourceMeta.validate`) surfaces errors as a red
  badge + message list in the Inspector and a red outline on the node.

**Status.** ✅ Complete — form and validation are declared on `ResourceMeta`
(`fields` / `validate`), edited through `updateNodeConfig`, with reusable
checkers in `src/resources/validators.ts`. SG rules are simplified to inbound
toggles (see ADR 0011).

**Related.** [ADR 0011 — Inspector property form & validation model](decisions/0011-inspector-property-form-and-validation.md)

---

## Phase 3 — Traffic simulation ✅

**Goal.** Animate a request flowing through the topology and highlight failures.

**Definition of Done.**
- ✅ **Start** button traces `client → LB → app → DB` and animates particles
  along the path edges (SVG `animateMotion`, staggered per hop).
- ✅ When the path is broken, the blocking node is highlighted (red pulse) with a
  Korean failure message; path nodes glow green on success.

**Status.** ✅ Complete — `src/graph/simulate.ts` does a greedy single-path trace
(entry = ALB/Lambda, sink = RDS/S3); `TrafficEdge` animates particles; the store
holds the `simulation` result. Scope: connectivity only — SG/route rules are not
modeled (see ADR 0012).

**Related.** [ADR 0012 — Traffic simulation model](decisions/0012-traffic-simulation-model.md) ·
[ADR 0003 — Mission system in MVP](decisions/0003-mission-system-in-mvp.md)
(mission clear checks build on the simulator).

---

## Phase 4 — Terraform HCL export ✅

**Goal.** Turn a valid design into runnable Terraform.

**Definition of Done.**
- ✅ **Export** button downloads a `main.tf` / `variables.tf` / `README.md` zip
  in the browser (JSZip).
- ✅ Output passes `terraform validate` — verified with Terraform v1.9.8 on the
  full 10-resource topology (superset of VPC / Subnet / SG / ALB / EC2 / RDS).
- ✅ `terraform apply` is explicitly **not** a goal (placeholder secrets/AMI/IAM).

**Status.** ✅ Complete — per-resource emitters (`ResourceMeta.terraform(ctx)`)
own their HCL; `src/graph/terraform.ts` resolves topology references and zips the
output. See ADR 0013.

**Related.** [ADR 0005 — Terraform generation approach](decisions/0005-terraform-generation-approach.md) ·
[ADR 0013 — Terraform export implementation](decisions/0013-terraform-export-implementation.md)

---

## Phase 5 — Mission system ✅

**Goal.** Deliver the game layer on top of the editor.

**Definition of Done.**
- ✅ 3 missions (tutorial / 3-tier / serverless) are completable end-to-end.
- ✅ Clear detection + 0–3 star rating, computed live and shown on the mission
  cards (filled stars + a "완료" badge).

**Status.** ✅ Complete — each mission owns a `check(ctx)` returning a star rating
(0 = not cleared). The check reuses the simulation result (ADR 0012) and the
validation sweep (ADR 0011). See ADR 0014.

**Related.** [ADR 0014 — Mission clear detection & star rating](decisions/0014-mission-clear-detection-and-stars.md) ·
[ADR 0003 — Mission system in MVP](decisions/0003-mission-system-in-mvp.md)

---

## History

| Date | Change |
| ---- | ------ |
| 2026-07-08 | Phase 0 completed (`7bfbd38`). Docs skeleton + ADRs 0001–0005 added. |
| 2026-07-08 | Deploy migrated to GitHub Pages; ADR 0007 added. |
| 2026-07-08 | Phase 1 completed: palette drag-and-drop, nesting & edge rules; ADR 0010 added. |
| 2026-07-08 | Phase 2 completed: Inspector property form + real-time validation; ADR 0011 added. |
| 2026-07-08 | Phase 3 completed: traffic simulation (path trace + particle animation); ADR 0012 added. |
| 2026-07-08 | Phase 4 completed: Terraform export (validate-passing HCL + zip); ADR 0013 added. |
| 2026-07-08 | Phase 5 completed: mission clear detection + star rating; ADR 0014 added. MVP feature-complete. |
| 2026-07-08 | Post-MVP: resizable containers (NodeResizer); graph-level CIDR validation (ADR 0015). |
| 2026-07-08 | v2 "엔지니어 시뮬레이션": apply-ready Terraform (ADR 0016), SG attachment edges + severity validation (ADR 0017), multi-flow playback + categorized palette + minimap toggle (ADR 0018), node naming, security-hardening mission. |
