# 0013. Terraform export implementation

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

[ADR 0005](0005-terraform-generation-approach.md)에서 "각 리소스가 자신의 HCL을
문자열로 뱉는 템플릿 함수 + 상위 export 로직이 그래프에서 참조를 해석"하기로
정했다. Phase 4에서 이를 실제로 구현하며 두 가지 구체적 결정이 필요했다:
(1) emitter가 참조(부모 VPC/서브넷 등)를 어떻게 전달받는가, (2) 어떤 파일·변수·
플레이스홀더로 `terraform validate`를 통과시키는가.

## Decision

**emitter 시그니처를 `terraform(ctx: TfContext)`로 확장**한다(ADR 0005의
`(id, config) => string`을 대체). 생성기
([`src/graph/terraform.ts`](../../src/graph/terraform.ts))가 그래프 topology를
한 번 훑어 각 노드의 `TfContext`를 만든다:

- `name` — TF 로컬 리소스명(하이픈→언더스코어, 참조에 사용). `awsName` — AWS
  `name`/`tags` 값(영숫자+하이픈).
- `refs` — 부모 체인에서 해석한 `vpc`/`subnet`, 같은 VPC의 `subnets`·
  `securityGroups` 로컬명. emitter는 그래프를 직접 걷지 않는다.

출력은 **`main.tf`**(provider + 리소스 블록), **`variables.tf`**, **`README.md`**
세 파일이며 JSZip으로 브라우저에서 zip 다운로드한다.

플레이스홀더/변수:
- `aws_region`(기본 `ap-northeast-2`), RDS가 있으면 `db_password`(sensitive,
  플레이스홀더 기본값), Lambda가 있으면 `lambda_role_arn`(플레이스홀더).
- Lambda `filename = "lambda.zip"`, EC2 AMI, IAM role 등은 apply 전 교체 대상.

`terraform validate` 통과를 위해 알게 된 것:
- **Security Group에는 `name`을 넣지 않는다** — AWS가 `sg-` 접두사를 예약하는데
  노드 id가 `sg-`로 시작해 검증에 걸린다. 이름은 AWS가 생성하고 `tags.Name`만 단다.
- 목표는 `validate` 통과이며 `apply`는 목표가 아니다(ADR 0005 유지).

## Consequences

- **좋은 점**: 각 리소스가 HCL을 소유(데이터 기반)하고, topology 참조는 생성기가
  일괄 해석한다. 생성 결과는 실제 `terraform validate`를 통과함을 확인했다(VPC/
  Subnet/IGW/NAT/SG/ALB/EC2/RDS/S3/Lambda 전체).
- **나쁜 점 / 한계**: 문자열 템플릿이라 타입 안전성이 약하다. `apply` 무결성은
  보장하지 않는다(플레이스홀더·AZ 분산·헬스체크 미반영). ALB의 백엔드 타깃 연결
  (엣지 기반)은 아직 HCL에 반영하지 않는다.
- **후속 영향**: ADR 0005의 emitter 시그니처를 이 ADR이 대체한다. 참조 종류가
  늘면 `TfContext.refs`를 확장한다.
