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
- ✅ `terraform apply` was **not** a Phase 4 goal (placeholder secrets/AMI/IAM).

**Status.** ✅ Complete — per-resource emitters (`ResourceMeta.terraform(ctx)`)
own their HCL; `src/graph/terraform.ts` resolves topology references and zips the
output. See ADR 0013.

> **Superseded post-MVP by [ADR 0016](decisions/0016-apply-ready-terraform.md).**
> The export is now **apply-ready**: the region and DB password are variables
> (the latter `sensitive`, no default), AMIs resolve via a `data.aws_ami` lookup,
> and Lambda ships a real IAM execution role + API Gateway. The only remaining
> `REPLACE_ME` markers are loud, non-appliable placeholders for resources the
> editor's nesting rules forbid (an orphaned EC2/subnet) — see
> [ADR 0025](decisions/0025-terraform-apply-audit.md).

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
| 2026-07-08 | RDS read replica: RDS → RDS replication edge + REPLICA badge + `replicate_source_db` emit (ADR 0019). |
| 2026-07-08 | Save & Share 스프린트 (제품 미팅 결정): Vitest 안전망 + CI 편입 (ADR 0021), localStorage 자동저장 + URL 공유 + JSON 내보내기/가져오기 (ADR 0020). |
| 2026-07-08 | 리소스 확장 1차 (10→14종): DynamoDB·CloudFront·Route 53·SQS + 미션 2종(글로벌 정적 웹, 비동기 파이프라인) (ADR 0022). |
| 2026-07-08 | CIDR 검증 apply 기준 강화: 호스트 비트 검사(정정 제안 포함) + AWS /16–/28 프리픽스 (ADR 0011 갱신). |
| 2026-07-08 | Editor Fundamentals 스프린트 (제품 미팅 #2): undo/redo, 첫 방문 온보딩, 공유 안전화(+미션 컨텍스트), 별점 최고기록, sanitize 리하이드레이트 (ADR 0023). |
| 2026-07-09 | Sprint A (부채 정리 & QA): TS strict 강화 — `noImplicitReturns` + `noUncheckedIndexedAccess` (ADR 0024); TF apply-readiness 감사 — blocker 0건, `REPLACE_ME` loud 마커 유지 (ADR 0025); 테스트 8→11 파일·42→59 케이스; 문서-코드 mismatch 5건 수정 (Phase 4 노트·ARCHITECTURE 시그니처·README/README.ko 구조·미션 목록). |
| 2026-07-09 | Sprint B (콘텐츠 확장 2차): 리소스 14→20종 — ECS·EKS·ElastiCache·EFS·SNS·CloudWatch(+새 `관리·모니터링` 카테고리) (ADR 0026); 미션 6→10종 — 컨테이너 워크로드·글로벌 동적 웹·이벤트 드리븐 팬아웃·재난 복구(Multi-AZ) (ADR 0027); 테스트 59→74 케이스. Kinesis는 데이터 레이크 미션과 함께 3차 배치로 보류. feature branch → PR → merge 워크플로로 진행. |
| 2026-07-09 | Sprint C (UX 심화): 키보드 단축키 통합(`useKeyboardShortcuts` — Undo/Redo/복제/삭제/Esc/R/S/E/?) + 노드 우클릭 컨텍스트 메뉴(속성·복제·엣지 지우기·부모 분리·삭제) (ADR 0028); 번들 code-splitting — rolldown `codeSplitting.groups`(react-flow/vendor) + JSZip·온보딩·모달 lazy import로 단일 574.76 kB → 최대 195.63 kB, 500 kB 경고 해소 + React Flow `onlyRenderVisibleElements` (ADR 0029); 인터랙티브 튜토리얼 — 미션 `steps?` 필드(튜토리얼만, backward-compatible) 실시간 체크리스트 (ADR 0030); CI 액션 v4→v5(node24 런타임, Node 20 deprecation 해소); 미팅 doc 워크플로 규칙 정합화. 테스트 74→80 케이스. |
| 2026-07-09 | Sprint D (소셜·공유 강화 — 오늘 4개 스프린트 중 마지막): 정적 OG 이미지(1200×630 PNG, PIL 생성) + Open Graph·Twitter Card 메타(절대 URL) (ADR 0031); 배지 5종 — `first-mission`·`first-three-star`·`first-slot`·`five-missions`·`all-three-star`, `bestStars`+슬롯 수에서 파생되는 순수 상태 + 세션 중 신규 획득만 토스트(마운트 백필) (ADR 0032); 다중 슬롯 갤러리 — persist `slots`(공유와 동일 스냅샷, 로드 시 재-sanitize) + 순수 SVG 즉석 썸네일, backward-compat(버전 미변경) (ADR 0033); i18n 유보 재검토 — Korean-first 유지, 도입 트리거 명시(별 100개·영어권 이슈 유입) (ADR 0034). Gallery·Achievements는 lazy 청크(≤5 kB), 최대 청크 197 kB 유지. 테스트 80→92 케이스. feature branch → PR → merge. |
| 2026-07-09 | Sprint E (리소스 확장 3차 + 검색): 리소스 20→26종 — Cognito·Secrets Manager·KMS·ACM·WAF(+`security` 카테고리를 `보안·아이덴티티`로 재정의)·Kinesis(ADR 0026 보류 해소, entry-capable) (ADR 0035); 미션 10→12종 — 데이터 파이프라인(Kinesis→Lambda→S3)·보안·인증 웹(CF→ALB→EC2→RDS + Cognito·Secrets·ACM·WAF) (ADR 0036); Palette 검색 — Zustand `search` + `useResourceSearch`(100ms debounce, label/description/category/type 매칭), `/` 포커스 단축키·Escape clear, `aria-live` 결과 카운트 (ADR 0037). `secretsmanager → kms` 고객 관리 키 배선. 테스트 92→109 케이스, 최대 청크 198 kB(500 kB 경고 없음), oxlint clean. feature branch → PR → merge. |
