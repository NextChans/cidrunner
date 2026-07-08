# Architecture Decision Records

This directory records the significant design decisions behind cidrunner, one
file per decision.

## Format

Each ADR follows the [Michael Nygard style](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
a short document with **Context** (the forces at play), **Decision** (what we
chose), and **Consequences** (what follows, good and bad). Records are numbered
sequentially and, once **Accepted**, are treated as immutable — a later decision
that reverses one is a *new* ADR that marks the old one `Superseded by NNNN`.

Each record's status is one of: `Proposed` · `Accepted` · `Superseded by NNNN` ·
`Deprecated`.

## Adding a new ADR

1. Copy [`template.md`](template.md).
2. Save it as `NNNN-<kebab-title>.md` using the next number in sequence.
3. Fill in Context / Decision / Consequences and set Status + Date.
4. Add a row to the index below.

## Index

| # | Title | Status | Date |
| - | ----- | ------ | ---- |
| [0001](0001-mvp-scope-and-resource-list.md) | MVP scope & resource list | Accepted | 2026-07-08 |
| [0002](0002-react-flow-over-blockly.md) | React Flow over Blockly | Accepted | 2026-07-08 |
| [0003](0003-mission-system-in-mvp.md) | Mission system in the MVP | Accepted | 2026-07-08 |
| [0004](0004-tech-stack.md) | Tech stack | Accepted | 2026-07-08 |
| [0005](0005-terraform-generation-approach.md) | Terraform generation approach | Accepted | 2026-07-08 |
| [0006](0006-ci-cd-workflow-split.md) | CI/Deploy workflow split & deploy secret gating | Accepted | 2026-07-08 |
| [0007](0007-github-pages-over-cloudflare.md) | GitHub Pages over Cloudflare Pages | Accepted | 2026-07-08 |
| [0008](0008-korean-first-ui-no-i18n.md) | Korean-first UI (hardcoded), no i18n framework | Accepted | 2026-07-08 |
| [0009](0009-mobile-responsive-drawer-pattern.md) | Mobile responsive drawer pattern for narrow viewports | Accepted | 2026-07-08 |
| [0010](0010-graph-nesting-and-edge-rule-model.md) | Graph nesting & edge rule model | Accepted | 2026-07-08 |
| [0011](0011-inspector-property-form-and-validation.md) | Inspector property form & validation model | Accepted | 2026-07-08 |
| [0012](0012-traffic-simulation-model.md) | Traffic simulation model | Accepted | 2026-07-08 |
| [0013](0013-terraform-export-implementation.md) | Terraform export implementation (refines 0005) | Accepted | 2026-07-08 |
| [0014](0014-mission-clear-detection-and-stars.md) | Mission clear detection & star rating | Accepted | 2026-07-08 |
| [0015](0015-graph-level-cidr-validation.md) | Graph-level CIDR validation | Accepted | 2026-07-08 |
| [0016](0016-apply-ready-terraform.md) | Apply-ready Terraform export (extends 0013) | Accepted | 2026-07-08 |
| [0017](0017-security-model-and-severity-validation.md) | Security model: SG attachment edges & severity validation | Accepted | 2026-07-08 |
| [0018](0018-multi-flow-playback-and-palette-categories.md) | Multi-flow playback & categorized palette (extends 0012) | Accepted | 2026-07-08 |
| [0019](0019-rds-read-replica-as-edge.md) | RDS read replica as a replication edge | Accepted | 2026-07-08 |
| [0020](0020-save-and-share.md) | Save & Share — localStorage autosave & URL sharing | Accepted | 2026-07-08 |
| [0021](0021-test-safety-net.md) | Test safety net for graph modules (Vitest) | Accepted | 2026-07-08 |
| [0022](0022-resource-expansion-batch-1.md) | Resource expansion batch 1 — DynamoDB · CloudFront · Route 53 · SQS (extends 0001) | Accepted | 2026-07-08 |
