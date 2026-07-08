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
  `deploy.yml` Cloudflare Pages deploy that is gated on the CF secrets.

**Status.** ✅ Complete — scaffold shipped in `7bfbd38`; CI split and lockfile
fix followed (see ADR 0006).

**Related.** [ADR 0004 — Tech stack](decisions/0004-tech-stack.md) ·
[ADR 0002 — React Flow over Blockly](decisions/0002-react-flow-over-blockly.md) ·
[ADR 0006 — CI/Deploy workflow split](decisions/0006-ci-cd-workflow-split.md)

---

## Phase 1 — Palette drag-and-drop, nesting & edge rules ⏳

**Goal.** Make the canvas editable: drag resources from the palette, nest them
correctly (VPC ▸ Subnet ▸ EC2/RDS …), and constrain edges by direction/type.

**Definition of Done.**
- Drag a resource from the palette and drop it onto the canvas to create a node.
- Nesting works: drop a Subnet inside a VPC, and an EC2 inside a Subnet.
- Invalid parent relationships are rejected in the UI (a Subnet cannot contain
  a VPC; an EC2 cannot be a top-level orphan where a Subnet is required).
- Edges enforce direction and type constraints (e.g. ALB → EC2, EC2 → RDS);
  disallowed connections are refused with visible feedback.

**Status.** ⏳ Planned.

**Related.** [ADR 0001 — MVP scope & resource list](decisions/0001-mvp-scope-and-resource-list.md)
(nesting rules will get their own ADR when the rule model is decided).

---

## Phase 2 — Inspector property editor & validation ⏳

**Goal.** Edit resource configuration and validate it in real time.

**Definition of Done.**
- Selecting a node shows a per-resource property form in the Inspector.
- Each resource seeds sensible default values (`ResourceMeta.defaults`).
- Real-time validation surfaces errors as red badges / tooltips
  (via `ResourceMeta.validate`).

**Status.** ⏳ Planned.

**Related.** ADR TBD — validation rule model.

---

## Phase 3 — Traffic simulation ⏳

**Goal.** Animate a request flowing through the topology and highlight failures.

**Definition of Done.**
- **Start** button animates particles `client → LB → target → DB`.
- When a rule is violated (broken path, missing route/SG), the blocking point is
  highlighted with a failure message.

**Status.** ⏳ Planned.

**Related.** [ADR 0003 — Mission system in MVP](decisions/0003-mission-system-in-mvp.md)
(mission clear checks build on the simulator).

---

## Phase 4 — Terraform HCL export ⏳

**Goal.** Turn a valid design into runnable Terraform.

**Definition of Done.**
- **Export** button downloads a zip in the browser.
- Output passes `terraform validate` for the minimum set
  (VPC / Subnet / SG / ALB / EC2 / RDS).
- `terraform apply` is explicitly **not** a goal.

**Status.** ⏳ Planned.

**Related.** [ADR 0005 — Terraform generation approach](decisions/0005-terraform-generation-approach.md)

---

## Phase 5 — Mission system ⏳

**Goal.** Deliver the game layer on top of the editor.

**Definition of Done.**
- 3 missions (tutorial / 3-tier / serverless) are completable end-to-end.
- Clear detection + star rating on completion.

**Status.** ⏳ Planned.

**Related.** [ADR 0003 — Mission system in MVP](decisions/0003-mission-system-in-mvp.md)

---

## History

| Date | Change |
| ---- | ------ |
| 2026-07-08 | Phase 0 completed (`7bfbd38`). Docs skeleton + ADRs 0001–0005 added. |
