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
