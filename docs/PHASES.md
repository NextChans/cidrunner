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
| 2026-07-09 | Sprint F1.5 (containment 정확도 — 차니 후속 P0.4~0.6): **allowedParents 전수 감사(26종)** — AWS 배치 모델과 대조, 전부 정합 확인(코드 변경 0), 리포트 초안의 Cognito/Secrets/KMS/ACM/WAF/Kinesis "→VPC" 분류는 부정확(리전/글로벌 서비스, `canvas` 유지)이라 정정, NAT "분리"는 모델 버그가 아닌 정규화·재부착 갭임을 규명 (ADR 0040); **auto-normalize** — `normalizeContainment`가 로드 경계(공유 URL·슬롯·localStorage 리하이드레이트)에서 parent 미설정이지만 공간적으로 컨테이너 안인 노드를 가장 안쪽 허용 컨테이너로 편입("없는 것만 채움", 절대→상대 좌표·위상 정렬, 한 패스 다중 깊이) (ADR 0040); **드래그 드롭-타깃 피드백** — transient `dropTarget`으로 드래그 중 컨테이너 실시간 하이라이트(유효=accent 링·틴트, 거부=rose) (ADR 0040). `absolutePosition`·`orderByParent`를 `graph/containment.ts`로 추출(스토어와 공유). 테스트 120→126(normalize 5·setDropTarget 1). tsc/oxlint clean. P0.7(Lambda/API GW 분리)은 F2 이월. feature branch → PR → merge. |
| 2026-07-09 | Sprint F2 (미션·SG 감사 + IGW 파생 점선 + ALB 정리 — 차니 리포트 4건): **미션 체커 감사** — 12개 미션 해피패스는 모두 정상이나 ★3(`securityOk`)가 **그래프 전체**를 평가해 손대지 않은 시드(VPC▸Subnet▸EC2, SG 없음)의 경고가 VPC-밖 미션(정적 웹·비동기·서버리스·이벤트·데이터 파이프라인)을 ★2에 가둔 것이 근본원인 → `scopedSecurityOk`(만족 flow에서 엣지 양방향+부모 체인 closure)로 8개 미션 전환, 무관 노드 무시·SSH 개방 SG 등 빌드 내부 경고는 유지 (ADR 0041); **SG 부착 규칙** — `sg.connectsTo`에 ecs·eks·elasticache·efs 추가, checks.ts에 EKS 경고 추가로 "부착 가능 집합==경고 집합" 불변식 확립(ECS↔SG 모순 해소), Lambda는 VPC-밖 모델로 제외 (ADR 0042); **IGW 파생 점선** — 엔진 소유 파생 엣지 프레임워크(`derived.ts`, 저장·편집 불가) IGW→퍼블릭 subnet slate 점선 + hover 툴팁 (ADR 0043); **ALB fallback 정리** — 외부 ALB의 퍼블릭 subnet 부재 시 프라이빗 fallback dead-path 제거, `REPLACE_ME` 명시(ECS/EKS와 일관) (ADR 0044). 그리디 tracer 백트래킹 부재는 테스트로 락인된 의도 동작이라 미변경. 테스트 126→139(missions 9·derived 4), tsc strict·oxlint clean, 최대 청크 199 kB. F3 예정: Lambda+API GW 분리. feature branch → PR → merge. |
| 2026-07-09 | **Hotfix QA-001** (containment-legality — F3 착수 전 안정화, `9aef4da`): QA 리포트 QA-001(Major) 해소 — containment가 **생성 시점에만** 강제되어 detach·공유 URL·슬롯 로드·hand-edit로 만든 "부모 없는 불법 배치"가 어디서도 검증되지 않던 갭. `graphIssues`([checks.ts](../src/graph/checks.ts))에 상시 룰 1개 추가 — `!canBeTopLevel(t)`이고 해석 가능한 parent가 없으면(미설정 + dangling parentId 모두) **error**. 글로벌 서비스(S3/Cognito/Kinesis 등 `canvas` 허용)는 자동 면제. 3중 파급 복원: 미션 ★2 오통과 차단(`allValid` 자동 게이팅), Terraform export error 차단 게이트([Toolbar.tsx](../src/components/Toolbar.tsx), REPLACE_ME 산출물 방지), sim 자연 정합(loose-ALB 면제는 유지하되 이제 graph error로 잡힘). auto-normalize(0040)와 협력 — 편입 못 하는 root 케이스를 error로 노출 (ADR 0045). 테스트 139→152(신규 containment-legality 13, detach 시나리오 포함), tsc strict·oxlint·vite build clean. feature branch → PR → merge. |
| 2026-07-09 | Sprint F1 (도메인 모델 정확도 — 차니 리포트 P0 3건): **Drop-onto-parent** — 기존 노드를 컨테이너로 드래그(`onNodeDragStop`) 시 자동 nest, 단일 스토어 `attachToParent`로 규칙 검증·사이클 방지·절대→상대 좌표 변환·위상 재정렬 (ADR 0038); **우클릭 "부모에 넣기 / 부모 변경"** — 후보 컨테이너 flyout 서브메뉴, "부모에서 분리"와 대칭(분리↔재부착 복구 가능) (ADR 0038); **IGW 인터넷 인그레스 sim** — 인터넷 페이싱 ALB(`internal!==true`, VPC 내)는 IGW+public subnet 없으면 sim 차단, internal·VPC 없는 ALB는 면제(회귀 방지), Option C(플레이어 라우팅 엣지) 기각 (ADR 0039). 테스트 109→120 케이스(신규 simulate-ingress 6·containment 5), tsc strict·oxlint clean, 최대 청크 199 kB. F2 예정: 인그레스 leg 시각 파생 점선·ALB fallback. feature branch → PR → merge. |
| 2026-07-09 | Sprint F3 (오늘의 마지막 스프린트 — Lambda/APIGW 분리 + 시뮬 정확도 + 트래픽 시각화): **Lambda + API GW 분리** — 콤보를 함수 전용 `lambda`(label `Lambda`, API GW v2 블록 제거)와 독립 `apigw`(REST API 6블록: rest_api·resource`{proxy+}`·method`ANY`·integration`AWS_PROXY`·deployment·stage + invoke permission, `apigw → lambda` 엣지로 integration 해석)로 분리, 리소스 **26→27**. CloudFront 오리진을 `lambda`→`apigw`로 재매핑(`<rest_api>.execute-api` 도메인 + stage origin_path). 미션 마이그레이션: **서버리스 API**만 `apigw → lambda → s3`로 갱신(requiredResources·check), 비동기·이벤트·데이터 파이프라인은 Lambda 단독 진입 유지(회귀 락인) (ADR 0046); **시뮬 백트래킹 (QA-002)** — greedy 단일 경로 tracer를 DFS+백트래킹으로 재작성, "sink 도달 경로 하나라도 있으면 성공", 되돌리지 않는 visited로 O(V+E)·사이클 종료, 실패 시 최장 경로로 block 힌트, 인그레스 게이트(0039) 통합. `simulate-edge.test.ts` 백트래킹 의미로 재설계(dead 브랜치 먼저 그려도 완결 sibling 발견 락인) (ADR 0047); **로드 밸런싱 애니메이션** — `SimResult.fanout`(도달·비차단 ALB의 모든 타깃 엣지 라운드로빈 슬롯, ≥2 타깃) + 엣지 시간차 발사 + ALB 노드 바이올렛 `lb-pulse` (ADR 0048); **엣지 in/out 시각 효과** — `SimResult.edgeStatus`(ok/blocked) + source 확산 링(out)·target 수렴 링(in) + 성공 녹색/차단 빨강 통일 (ADR 0049). 테스트 152→159(백트래킹·apigw terraform·viz 메타), tsc strict·oxlint·vite build clean(최대 청크 199 kB, 500 kB 경고 없음). 로컬 프리뷰로 4개 스코프 라이브 확인(apigw 진입·백트래킹 우회·fan-out·in/out 링). feature branch → PR → merge. |
| 2026-07-09 | Sprint F3 후속 수정 (리뷰·QA 피드백, 각 PR): **fan-out 전체 라이브 경로 하이라이트** — 백트래킹이 성공 경로 1개만 켜서 ALB fan-out 다운스트림 중 한쪽 EC2→RDS만 green이던 모순 → 하이라이트를 "모든 유효 entry→sink 서브그래프"(forward∩backward 도달)로 계산, in/out 링 확대(#21); **서버리스 API 목표 문구** — `클라이언트 →` 잔재 제거, API Gateway가 진입점임을 명시(#22); **RDS 복제 흐름 시각화** — `SimResult.replicaArrivals`, 프라이머리 도달 시 rds→rds 엣지 인디고 파티클+복제본 인디고 pulse(요청 녹색과 구별)(#23); **비동기/이벤트 파이프라인 판정** — `path[0]==='lambda'`가 API GW 프론트(진입점=apigw)·생산자 분기에서 오탐 → 라이브(ok) 엣지 위 구조적 체인 매칭(`liveChain`)으로 재작성(#24); **컨테이너 크기 영속 버그** — NodeResizer가 top-level `width/height`에 쓰는데 `sanitizeSnapshot`은 `style`만 읽어, 새로고침 시 컨테이너가 원래 크기로 되돌아가며 `extent:parent` 자식이 클램프·뒤섞임 → sanitize가 `width/height/measured` 우선 복원(컨테이너 한정). **경로 기반 미션 구조적 판정 일반화** — 단일 추적 flow 검사는 fork(ALB가 EC2·컨테이너로 팬아웃)·optional front(CloudFront/API GW 앞단)에서 오탐. `liveChain`을 `scope.ts`로 이동·일반화(대안 스텝 `['alb',['ecs','eks'],'rds']`·simple-path)하고 container-workload·three-tier·global-web·secure-auth·static-cdn·serverless·data-pipeline 전부 라이브(ok) 엣지 위 구조적 체인 매칭으로 전환(캐노니컬 빌드 3★ 회귀 없음). 테스트 159→167, tsc·oxlint·build clean. 각 feature branch → PR → merge. |
| 2026-07-09 | Sprint G (조직 컨테이너 + 상속 — 차니 요청): **AWS Account · Availability Zone 박스 신설**, 리소스 27→**29**. **가산적 계층** `Account ▸ VPC ▸ AZ ▸ Subnet`(VPC `allowedParents`에 `account`, Subnet에 `az` 추가 — 기존 'VPC 직속 Subnet'·최상위 VPC 그대로, 12미션 fixture 무변경). **생성 시점 상속**(`graph/inherit.ts`) — Subnet은 상위 VPC CIDR에서 다음 빈 `/24` 자동 배정(형제 충돌 0)+상위 AZ 박스의 `az` 상속, AZ 박스는 같은 VPC 내 다음 미사용 AZ 문자 기본값. 이후 인스펙터 변경 가능. **조직용 Terraform**(Account/AZ emit `''` — Account=provider 컨텍스트, AZ=Subnet 속성). `cidr.ts` containment/overlap을 직접 parentId→상위 체인 VPC(`enclosingVpc`)로 수정(AZ 삽입 투명), terraform/checks/simulate의 VPC 탐색은 이미 체인워크라 무변경 (ADR 0050). 테스트 167→**175**(inherit 6·rules 1·cidr 2·terraform 1), tsc·oxlint·build clean(199.8 kB). 로컬 프리뷰로 Account▸VPC▸AZ▸Subnet▸EC2 중첩·검증(에러 0)·팔레트 확인. feature branch → PR → merge. |
| 2026-07-09 | Sprint H (재미 축 #1 — 비용 예산 모드, "재미 부족" 피드백): 게임 루프가 체크리스트라 트레이드오프가 없던 문제 → **비용** 축 도입. `graph/cost.ts` 대략적 월 비용 모델(실제 함정 반영: NAT $32·ALB $16·EKS $73·ECS $18, EC2 instance_type별·RDS instance_class×multi_az, 플러밍/조직 박스 $0, 사용량 과금 소액). `Mission.budget?` 선택 필드 + 주요 미션 예산 설정(three-tier/container/secure-auth $60, global-web $55, DR $50 등 — clean 빌드는 통과·낭비는 초과). **캔버스 실시간 비용 미터**(top-left, 예산 내 녹색·초과 빨강⚠️) + **미션 카드 예산 라인**. 별 게이트 무변경(예산=자기부과 목표, 무회귀). 비용은 `ResourceMeta` 아닌 `cost.ts` 한 곳(밸런스 노브) (ADR 0051). 테스트 175→**181**(cost 4 등), tsc·oxlint·build clean. 로컬 프리뷰로 clean 3-tier $50/예산$60 ✓(녹색)·NAT 추가 $82 초과(빨강) 확인. 다음 재미 축 후보: 카오스 모드·Well-Architected 등급. PR 즉시 머지. |
| 2026-07-09 | Sprint I (재미 축 #2 — 카오스 모드): "예산 단독은 얇다 — 대가·트레이드오프 필요" 판단 → **AZ 장애 주입**으로 비용↔복원력 딜레마 완성. `graph/chaos.ts`(`nodeAz`·`graphAzs`·`deadNodesForAz`) — AZ 다운 시 해당 존 리소스 사망, **Multi-AZ RDS는 페일오버 생존**(2배 값 보상), AZ 독립 리소스(멀티-AZ ALB·글로벌) 생존. `simulate(nodes,edges,{deadNodeIds})` — 죽은 노드 제거 후 기존 백트래킹 도달성으로 생존/차단 판정, `SimResult.deadNodeIds` 노출. **카오스 패널**(bottom-center, AZ별 토글+복구) + 죽은 노드 흐림(opacity·grayscale·⚡). 별 판정·Terraform 불변, deadNodeIds 없으면 완전 기존 동작 (ADR 0052). 테스트 181→**186**(chaos 4), tsc·oxlint·build clean. 로컬 프리뷰로 단일-AZ($37)→AZ-a 다운 시 붕괴·2-AZ+Multi-AZ RDS($58)→생존(ec2b 재라우팅) 확인. 튜토리얼 AZ-박스 중첩 판정 fix(#30) 포함. PR 즉시 머지. |
| 2026-07-09 | Sprint I 후속 (카오스 RDS 복원 정확화 — 사용자 피드백 "AZ 죽였는데 트래픽이 여전히 마스터로"): AWS 두 패턴 구분해 `applyAzFault` 추가 — **Multi-AZ RDS**는 자동 페일오버로 생존(동일 엔드포인트, 승격 아님) + **⚡ 페일오버** 배지로 "죽은 AZ 안 alive" 혼란 해소; **단일-AZ 마스터**가 죽고 다른 AZ에 읽기 복제본 있으면 **승격**하고 마스터行 트래픽 엣지를 복제본으로 **재라우팅**(⬆ 승격 배지). `SimResult.failoverNodeIds`·`promotedNodeIds` + `simulate` opts로 에코, 스토어 `runWithChaos`가 적용. 배너는 재라우팅된 경로 표시(`alb → ec2 → replica`). 무회귀(정상 sim 시 완전 동일). 테스트 187→**189**(페일오버·승격), tsc·oxlint·build clean. 로컬 프리뷰로 단일-AZ 마스터 사망→복제본 승격·재라우팅 확인 (ADR 0053). PR 즉시 머지. |
| 2026-07-09 | Sprint J (재미 축 #3 — Well-Architected 등급 + EKS 비용 정정): 비용·카오스·checks 신호를 하나의 A~S 등급으로 종합. `graph/grade.ts` `wellArchitectedGrade` — 🔒 보안(경고), 🛡 신뢰성(멀티-AZ+DB 복원+모든 단일-AZ 장애 생존, `applyAzFault` 활용), 💰 비용(방치 고비용 리소스), ⚡ 성능(가속기 존재) 4기둥 평균 → 레터. 캔버스 좌상단(비용 미터 아래) 실시간 배지, 표시 전용(별점 불변). **EKS 비용 정정** — self-contained 노드 그룹(워커 EC2 2대) 포함해 `73 + 2×노드타입비용`(t3.medium→133) (ADR 0026/0054). 테스트 189→**194**(grade 4·cost EKS 2 갱신), tsc·oxlint·build clean. 로컬 프리뷰로 이중화 3-tier **S 등급**(🔒100 🛡100 💰100 ⚡62) 확인 (ADR 0054). PR 즉시 머지. |
| 2026-07-09 | Sprint K (TF export 동작·배치 결함 — 차니 TF 리뷰 🅰): export한 HCL이 "validate는 통과하나 apply해도 안 뜨는" 갭 수정. **티어드 SG ingress** — SG 모델이 0.0.0.0/0 토글만 emit해 앱/DB SG ingress 부재로 ALB→EC2:80·EC2→RDS:3306 차단되던 것을, 트래픽 토폴로지에서 SG-to-SG 유도(`sgIngressFor`, app SG←ALB SG:80, RDS SG←app SG:3306(engine별)·6379·2049). **프라이빗 배치** — DB subnet group·EKS 노드그룹을 프라이빗 서브넷만으로(퍼블릭 배치 제거), EKS 클러스터에 부착 SG 반영. **RDS 자격증명** — `var.db_password` 평문 → `manage_master_user_password=true`(SM 관리형·회전) + `backup_retention_period=7`, db_password 변수 제거. 별점·시뮬 불변, 195 tests green. 🅱(HTTPS/WAF/authorizer/alarm 엣지 배선)·🅲(감사로그) 후속 (ADR 0055). PR 즉시 머지. |
| 2026-07-09 | Sprint L (보안 attachment 배선 + 준비도 manifest — 차니 재분류): 🅰/🅱 경계를 "노력"이 아니라 "도구 능력"으로 재정의. #3/#4/#5는 블록이 이미 있어 **모델 확장 가능** 계층(=🅰급)이었고, 특히 **#3이 최위험**(HTTP-only는 조용히 성공 + cert가 아무 리스너에도 안 물린 PENDING_VALIDATION 좀비). ACM/WAF/Cognito에 **security-attachment 엣지**(source=보안 블록, SG처럼 시뮬 traffic 제외 → 진입점 보존) 신설: `acm→alb`=**HTTPS:443 리스너+80 redirect**, `waf→alb\|apigw`=**web_acl_association**, `cognito→apigw`=**COGNITO_USER_POOLS authorizer**. export에 **`PRODUCTION-READINESS.md`**(머신리더블 manifest) 항상 동봉 — 미배선 보안(cert 없는 ALB·authorizer 없는 API)+스코프 밖(앱 시크릿 소비·CMK·감사로그·CloudFront 멀티리전·alarm 액션·단일 NAT) 자백. CloudFront TLS/WAF는 멀티리전 provider 필요라 의도적 제외(manifest 고지). 별점·시뮬 불변, 195→**198** tests green(TLS/WAF/Cognito 배선·0.0.0.0/0 부재 가드·manifest; `expansion-3`의 no-edges 전제 대체), tsc·oxlint·build clean (ADR 0056). PR 즉시 머지. |
