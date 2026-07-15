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
| [0023](0023-editor-fundamentals.md) | Editor Fundamentals — undo/redo, 온보딩, 공유 안전화 | Accepted | 2026-07-08 |
| [0024](0024-typescript-strict-hardening.md) | TypeScript strict 전면 적용 (noImplicitReturns · noUncheckedIndexedAccess) | Accepted | 2026-07-09 |
| [0025](0025-terraform-apply-audit.md) | Terraform apply-readiness 감사 (Sprint A) | Accepted | 2026-07-09 |
| [0026](0026-resource-expansion-2.md) | Resource expansion batch 2 — ECS · EKS · SNS · EFS · ElastiCache · CloudWatch (extends 0022) | Accepted | 2026-07-09 |
| [0027](0027-mission-expansion-2.md) | Mission expansion batch 2 — 컨테이너 · 글로벌 동적 웹 · 이벤트 드리븐 · 재난 복구 | Accepted | 2026-07-09 |
| [0028](0028-keyboard-shortcuts-and-context-menu.md) | 키보드 단축키 & 노드 우클릭 컨텍스트 메뉴 | Accepted | 2026-07-09 |
| [0029](0029-perf-code-splitting.md) | 성능 — 번들 code-splitting & 대형 그래프 렌더링 | Accepted | 2026-07-09 |
| [0030](0030-interactive-tutorial-steps.md) | 인터랙티브 튜토리얼 — 단계별 자가 점검 힌트 | Accepted | 2026-07-09 |
| [0031](0031-og-image-and-share-metadata.md) | OG 이미지 & 소셜 공유 메타데이터 | Accepted | 2026-07-09 |
| [0032](0032-achievements-and-badges.md) | Achievements — 배지 시스템 (5종, 파생 상태) | Accepted | 2026-07-09 |
| [0033](0033-gallery-multi-slot.md) | 갤러리 — 다중 슬롯 저장 (extends 0020) | Accepted | 2026-07-09 |
| [0034](0034-i18n-defer.md) | i18n 유보 재검토 — Korean-first 유지 (revisits 0008) | Accepted | 2026-07-09 |
| [0035](0035-resource-expansion-3-security-and-streaming.md) | Resource expansion batch 3 — Cognito · Secrets Manager · KMS · ACM · WAF · Kinesis (extends 0026) | Accepted | 2026-07-09 |
| [0036](0036-mission-expansion-3-pipelines-and-auth.md) | Mission expansion batch 3 — 데이터 파이프라인 · 보안·인증 웹 | Accepted | 2026-07-09 |
| [0037](0037-palette-search.md) | Palette 검색 — debounced 실시간 필터 + `/` 단축키 | Accepted | 2026-07-09 |
| [0038](0038-containment-attach-actions.md) | Containment attach 액션 대칭화 — drop-onto-parent + 우클릭 "부모에 넣기" | Accepted | 2026-07-09 |
| [0039](0039-igw-internet-ingress-simulation.md) | IGW 인터넷 인그레스 시뮬레이션 — external entry 도달성 검사 | Accepted | 2026-07-09 |
| [0040](0040-containment-audit-normalize-feedback.md) | Containment 정확도 — allowedParents 감사 · auto-normalize · 드래그 피드백 (extends 0038) | Accepted | 2026-07-09 |
| [0041](0041-mission-checker-audit.md) | 미션 체커 감사 — 별점 스코핑 · 힌트/체크 정합 (extends 0036) | Accepted | 2026-07-09 |
| [0042](0042-sg-attach-rules.md) | Security Group 부착 규칙 — sgAttachable 정정 · 경고 정합 (extends 0017) | Accepted | 2026-07-09 |
| [0043](0043-derived-visual-edges.md) | 파생 시각 엣지 — 엔진 소유 IGW → 퍼블릭 Subnet 점선 (extends 0039) | Accepted | 2026-07-09 |
| [0044](0044-alb-fallback-cleanup.md) | ALB 서브넷 fallback 정리 — dead-path 명시화 (extends 0016) | Accepted | 2026-07-09 |
| [0045](0045-containment-legality-validation.md) | Containment-legality 상시 검증 — 부모 없는 불법 배치 감지 (QA-001 hotfix, extends 0017·0038·0040) | Accepted | 2026-07-09 |
| [0046](0046-lambda-apigw-split.md) | Lambda + API GW 콤보 분리 — 독립 API Gateway 리소스 (extends 0001·0016·0022) | Accepted | 2026-07-09 |
| [0047](0047-simulate-backtracking.md) | 시뮬레이션 백트래킹 — greedy → DFS 다중 경로 탐색 (QA-002, extends 0012·0018·0039) | Accepted | 2026-07-09 |
| [0048](0048-load-balancing-animation.md) | 로드 밸런싱 애니메이션 — ALB fan-out 시각화 규격 (extends 0012·0018·0047) | Accepted | 2026-07-09 |
| [0049](0049-edge-inout-visual-effects.md) | 엣지 in/out 트래픽 시각 효과 — 방향 인지도 강화 (extends 0012·0043·0047) | Accepted | 2026-07-09 |
| [0050](0050-account-az-containers-and-inheritance.md) | AWS Account · AZ 조직 컨테이너 + 컨테이너 상속 (리소스 27→29, extends 0010·0015·0040) | Accepted | 2026-07-09 |
| [0051](0051-cost-budget-mode.md) | 비용 예산 모드 — 실시간 월 비용 추정 + 미션 예산 목표 (extends 0014·0016) | Accepted | 2026-07-09 |
| [0052](0052-chaos-mode-fault-injection.md) | 카오스 모드 — AZ 장애 주입 (비용↔복원력 딜레마, extends 0047·0050·0051) | Accepted | 2026-07-09 |
| [0053](0053-chaos-rds-failover-and-promotion.md) | 카오스 RDS 복원 — Multi-AZ 페일오버 & 읽기 복제본 승격 (extends 0019·0052) | Accepted | 2026-07-09 |
| [0054](0054-well-architected-grade.md) | Well-Architected 등급 — 4개 기둥 종합 점수 (+ EKS 비용 정정, extends 0017·0051·0052) | Accepted | 2026-07-09 |
| [0055](0055-terraform-apply-wiring.md) | Terraform 동작·배치 결함 수정 — 티어드 SG · 프라이빗 배치 · SM 관리형 자격증명 (TF 리뷰, extends 0016·0017·0025) | Accepted | 2026-07-09 |
| [0056](0056-security-attachment-wiring-and-readiness-manifest.md) | 보안 attachment 배선(HTTPS·WAF·Cognito authorizer)과 프로덕션 준비도 manifest (TF 리뷰 재분류, extends 0035·0046·0055) | Accepted | 2026-07-09 |
| [0057](0057-ops-challenge-star-gates.md) | 운영 챌린지 티어 — 비용·카오스를 별점 게이트로 (extends 0051-0053) | Accepted | 2026-07-09 |
| [0058](0058-playback-audio.md) | 재생 사운드 — 홉 틱·도착 차임·차단 버즈, Web Audio 합성 (extends 0012·0047-0049) | Accepted | 2026-07-09 |
| [0059](0059-security-groups-as-assignment.md) | 보안 그룹 재설계 — 엣지 부착 → 리소스 할당(칩+라이브러리), Terraform 어댑터·영구 마이그레이션 (supersedes 0017·0042) | Accepted | 2026-07-10 |
| [0060](0060-edge-auto-orient.md) | 엣지 자동 방향 정렬 — 반대로 그어도 유효한 방향으로 (다중 핸들 리소스 방향 혼동 해소) | Accepted | 2026-07-10 |
| [0061](0061-resilient-import.md) | 관대한 불러오기 — 모르는 리소스 타입은 건너뛰고 알림(전체 거부 → 부분 로드, extends 0020·0023) | Accepted | 2026-07-10 |
| [0062](0062-ecr-cloudtrail-resources.md) | ECR·CloudTrail 정식 리소스 추가 (29→31, apply-ready TF·CloudTrail S3 버킷 정책 파생) | Accepted | 2026-07-10 |
| [0063](0063-looping-playback-audio.md) | 재생 사운드 루프 — 파티클 CYCLE(1.4s)과 위상 고정해 계속 재생 (reverses 0058 one-pass) | Accepted | 2026-07-10 |
