# 0025. Terraform apply-readiness 감사 (Sprint A)

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

ADR 0016에서 export를 "apply-ready"로 선언했으나, Sprint A(부채 정리)에서 그 주장을 실제
생성물 기준으로 재감사할 필요가 있었다. 실 배포(`terraform init && apply`)를 막는 잔재 —
하드코딩 시크릿, AMI 플레이스홀더, 누락 IAM, `filename`/`source_code_hash` 스텁, region 고정 —
가 남아 있는지 리소스별 emitter(`src/resources/*.ts`)와 조립기(`src/graph/terraform.ts`)를
전수 검토했다.

## Decision

### 감사 결과: 실 배포 blocker 0건

| 항목 | 상태 | 근거 |
| ---- | ---- | ---- |
| **시크릿(RDS 마스터 PW)** | ✅ 해소 | `var.db_password` — `sensitive = true`, default 없음. 복제본은 소스 credential 상속(미방출). |
| **AMI** | ✅ 해소 | `ami-` 직접 입력이 아니면 `data.aws_ami.al2023`(최신 AL2023) 조회로 동적 해결. |
| **IAM** | ✅ 해소 | Lambda는 실 실행 역할 + `AWSLambdaBasicExecutionRole`, 큐 소비 시 `...SQSQueueExecutionRole` 부착. |
| **Lambda 패키지** | ✅ 해소 | `archive_file` 인라인 hello-world → `filename`/`source_code_hash` 실체값. |
| **API Gateway** | ✅ 해소 | HTTP API + integration/route/stage/permission 완비, endpoint output 노출. |
| **region** | ✅ 해소 | `var.aws_region`(default `ap-northeast-2`), provider가 변수 참조 — 하드코딩 없음. |
| **파생 네트워킹** | ✅ 있음 | route table/association(IGW→public, NAT→private), DB subnet group을 토폴로지에서 파생. |

### 잔존 `REPLACE_ME` 6곳 — 유지 (수정하지 않음)

`igw`·`subnet`·`sg`·`alb`(→`refs.vpc`), `ec2`·`nat`(→`refs.subnet`)의 부모 참조 fallback에
`?? 'REPLACE_ME'`가 있다. 이는 **필수 부모(VPC/Subnet) 조상이 없는 고아 리소스**에서만 발현한다.
에디터의 nesting 룰(`allowedParents`, `src/graph/rules.ts`)이 이런 배치를 애초에 막으므로
정상 그래프에서는 나타나지 않는다.

**판단: 유지한다.** 만에 하나 고아 리소스가 export되더라도 HCL이 *apply 가능한 척*하면 안 된다.
`REPLACE_ME`는 `terraform validate`에서 즉시 실패하는 **loud 마커**로, 유령 참조를 조용히
방출하는 것보다 안전하다. 침묵 실패(silent broken ref) 대신 시끄러운 실패(fail-fast)를 택한다.

이 결정을 회귀로부터 지키기 위해 `terraform-audit.test.ts`에 불변식을 락인했다:
region 변수화, `db_password` sensitive·no-default, 고아 EC2 → `aws_subnet.REPLACE_ME.id`,
SG inbound 토글/egress allow-all, S3 secure-by-default.

## Consequences

- **실 apply 가능 조건**: (1) 에디터에서 만든 정상(nesting 룰 준수) 그래프일 것,
  (2) RDS 포함 시 `terraform apply -var db_password=...` 또는 `TF_VAR_db_password` 제공,
  (3) 필요 시 `var.aws_region` 조정. 이 조건에서 `REPLACE_ME`는 나타나지 않는다.
- **비용 경고 유지**: NAT/ALB/RDS는 시간당 과금 — main.tf/README 주석과 `terraform destroy` 안내 유지.
- **코드 변경 없음**: 감사 결과 emitter 로직 수정은 불필요. 변경은 테스트(불변식 락인)와
  문서(PHASES Phase 4의 stale "placeholder secrets/AMI/IAM" 주석 → 본 ADR로 supersede)뿐.
- **관련**: [ADR 0013](0013-terraform-export-implementation.md) · [ADR 0016](0016-apply-ready-terraform.md) ·
  [ADR 0019](0019-rds-read-replica-as-edge.md).
