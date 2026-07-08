# Contributing

Lightweight rules for keeping cidrunner's design legible as it grows.

## Record important decisions as ADRs

Any meaningful design or scope decision **must** be captured as an Architecture
Decision Record under [`decisions/`](decisions/) — not left only in chat or a
commit message.

- Copy [`decisions/template.md`](decisions/template.md).
- Name it `NNNN-<kebab-title>.md` with the next number in sequence.
- Fill in **Context / Decision / Consequences** and set the **Status**.
- Add it to the index in [`decisions/README.md`](decisions/README.md).

## Keep phase docs current

When you complete or materially change a phase:

- Update its status in [`PHASES.md`](PHASES.md).
- Add a line to the **History** table there.
- Do it in the same PR as the code — not later.

## Update docs alongside code

If a change alters architecture, resources, or the data flow, update
[`ARCHITECTURE.md`](ARCHITECTURE.md) in the same PR. Treat "did the docs move
with the code?" as a review checkpoint.

## Commit messages

Use a conventional-commit prefix:

| Prefix | Use for |
| ------ | ------- |
| `feat:` | new user-facing capability |
| `fix:` | bug fix |
| `docs:` | documentation only |
| `chore:` | tooling, deps, scaffolding |

## Code style

- TypeScript strict; no `any` where a real type is knowable.
- Keep the resource/mission registries data-driven — prefer extending
  `ResourceMeta` / `Mission` over per-resource branching in components.
