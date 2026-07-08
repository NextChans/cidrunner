# 0016. Apply-ready Terraform export

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

[ADR 0013](0013-terraform-export-implementation.md)의 목표는 `terraform validate`
통과였고, AMI·IAM 롤·시크릿은 플레이스홀더였다. 요구가 "다운받아 `apply` 하면
실제로 AWS 리소스가 생성될 수준"으로 올라갔다. 문제는 캔버스에 그리지 않는
배관(라우트 테이블, DB 서브넷 그룹, Lambda 실행 롤, 배포 패키지)을 어떻게
채우느냐다.

## Decision

**캔버스는 아키텍처만, 배관은 생성기가 유도한다.**
`generateTerraform(nodes, edges)`가 topology에서 다음을 자동 생성한다:

- **라우트 테이블** — VPC에 IGW가 있으면 퍼블릭 RT(0.0.0.0/0→IGW)+연결, NAT가
  있으면 프라이빗 RT(0.0.0.0/0→NAT)+연결.
- **DB 서브넷 그룹** — RDS가 있는 VPC의 전체 Subnet으로 구성 (2개 AZ는 검증이 강제).
- **AMI** — EC2의 `ami: "auto"`는 `data "aws_ami"` (최신 Amazon Linux 2023)로
  해석. `ami-...` 직접 입력도 허용.
- **Lambda 실행 환경** — IAM 롤 + `AWSLambdaBasicExecutionRole`, archive
  provider로 런타임별 인라인 hello-world zip, API GW v2(api/integration/route/
  stage/permission) 전체 체인. apply 직후 호출 가능한 엔드포인트가 나온다.
- **엣지 반영** — SG→리소스 엣지는 `security_groups`/`vpc_security_group_ids`로,
  ALB→EC2 엣지는 `aws_lb_target_group_attachment`로.
- **outputs.tf** — ALB DNS, API 엔드포인트, S3 버킷명, RDS 엔드포인트.
- **시크릿** — `db_password`는 default 없는 sensitive 변수 (apply 시 `-var` 필요).
- EC2 `user_data`로 nginx를 올려 ALB 헬스체크가 통과하도록 한다.

전체 베스트 프랙티스 토폴로지(2 AZ, IGW+NAT, SG 연결, 3-tier + 서버리스)로
Terraform v1.9.8 `init`+`validate` 통과를 확인했다.

## Consequences

- **좋은 점**: export가 학습용 스켈레톤이 아니라 실제 인프라 코드가 된다.
  outputs와 README(비용 경고 포함)로 엔지니어 워크플로우를 그대로 재현한다.
- **나쁜 점 / 한계**: 실제 `apply`는 AWS 자격 증명이 필요해 CI에서 검증하지
  못한다(validate까지 검증). NAT·ALB·RDS는 시간당 과금 — README에 destroy 경고를
  명시했다. Lambda 코드는 hello-world 스텁이다.
- **후속 영향**: ADR 0013을 이 ADR이 확장한다. `TfContext.refs`에
  `publicSubnets`/`targets`가 추가되고 `displayName`(플레이어 지정 이름)이 태그로
  들어간다.
