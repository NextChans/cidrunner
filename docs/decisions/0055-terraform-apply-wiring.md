# 0055. Terraform 동작·배치 결함 수정 — 티어드 SG · 프라이빗 배치 · 관리형 자격증명

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0016](0016-apply-ready-terraform.md), [0017](0017-security-model-and-severity-validation.md), [0025](0025-terraform-apply-audit.md), [0026](0026-resource-expansion-2.md)

## Context

export한 Terraform을 차니(시니어/전자금융)가 정식 리뷰한 결과, **"validate는 통과하지만 apply해도 실제로 동작하지 않는다"**는 갭이 드러났다. ADR 0016/0025의 "apply-ready"는 `terraform validate` + 리소스 생성까지였지, **기능적으로 배선된 인프라**까지가 아니었다. 리뷰 결함을 성격별로 트리아지해 **동작·배치 결함(🅰)** 을 먼저 닫는다(보안 배선 🅱·감사로그 🅲는 후속).

## Decision (🅰 — 이 ADR 범위)

### 1. 티어드 SG ingress (최대 임팩트)

기존 SG 모델(ADR 0017)은 `allow_http/https/ssh`를 **전부 0.0.0.0/0**으로만 emit → 앱/DB SG는 ingress가 없어 `ALB→EC2:80`, `EC2/EKS→RDS:3306`이 전부 막혔다(TG 헬스체크 실패, DB 접근 불가).

`terraform.ts`가 **트래픽 토폴로지에서 SG-to-SG ingress를 유도**한다(`sgIngressFor`, `refs.sgIngress`): SG가 부착된 리소스로 트래픽을 보내는 소스의 SG를, 대상의 서비스 포트로 허용한다. 예: app SG는 `ALB SG → :80`, RDS SG는 `app SG → :3306`(engine별 3306/5432), ElastiCache `:6379`, EFS `:2049`. 인터넷 토글(0.0.0.0/0)은 인터넷-페이싱 SG용으로 그대로 유지하고 티어드 규칙을 추가.

### 2. 프라이빗 배치

- **DB subnet group**: VPC 전체 서브넷 → **프라이빗 서브넷만**(퍼블릭 2개 미만이면 fallback). RDS가 퍼블릭 서브넷에 배치될 여지 제거.
- **EKS 노드그룹**: `subnet_ids`를 **프라이빗 서브넷**으로 제한(워커가 퍼블릭에 뜨지 않음). 컨트롤 플레인 `vpc_config`는 부착 SG(`security_group_ids`)를 반영해 데이터 계층 접근 가능.

### 3. RDS 자격증명 — Secrets Manager 관리형

`password = var.db_password`(tfstate 평문 + 회전 없음) → **`manage_master_user_password = true`**(RDS 관리형 SM, 자동 회전). `db_password` 변수·README의 `-var` 안내 제거. `backup_retention_period = 7` 추가. `deletion_protection`/final snapshot은 게임의 teardown 편의를 위해 그대로 두되 문서에 프로덕션 델타 명시.

## Consequences

- **실제 동작하는 export** — 앱/DB SG ingress가 자동 배선돼 헬스체크·DB 접근이 뜬다. "validate 통과"에서 "apply하면 돌아간다"로 상향.
- **보안 기본값 개선** — 평문 비밀번호 제거, DB/워커 프라이빗 강제.
- **무회귀** — 195개 테스트 green(신규 SG 티어드·프라이빗 dbsg, RDS 관리형·백업으로 갱신). 별점·시뮬 불변.
- **리뷰 대비 처리 현황**:
  - 🅰 **완료**: #1(SG ingress)·#2(EKS 노드 SG)·#8(dbsg 프라이빗)·#11(EKS 노드 프라이빗)·#6(SM 관리형)·RDS 백업.
  - 🅱 **후속**: #3 ACM→ALB HTTPS·#4 WAF association·#5 Cognito authorizer·CloudWatch→SNS alarm_actions·#9/#10 AZ별 RT — 각 엣지 규칙 추가 필요.
  - 🅲 **스코프 판단**: #7 감사로그(Flow Logs/CloudTrail/ALB access log — 블록 없음), CloudFront us-east-1 커스텀 cert(멀티리전).
  - **버그 아님**: EC2/EKS 의도·orphan은 그래프 선택. ALB→ECS/EKS TG 미등록은 기존 의도(ADR 0026/QA-003).
