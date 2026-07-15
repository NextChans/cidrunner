# 0062. ECR · CloudTrail 정식 리소스 추가 (리소스 29→31)

- Status: Accepted
- Date: 2026-07-10
- Deciders: 차니, Claude

## Context

차니의 실제 prod topology(ADR 0061에서 관대한 불러오기로 부분 로드됨)에서 빠졌던
두 리소스 **ECR**(컨테이너 이미지 레지스트리)와 **CloudTrail**(계정 API 감사)을 정식
리소스로 추가한다. 둘 다 결제 인프라의 표준 구성요소이고, 제외되면 topology의 공급망
무결성(ECR 스캔/불변 태그)과 감사(CloudTrail→WORM S3) 서사가 사라진다. 차니가
`AskUserQuestion`에서 "둘 다 추가"를 선택했다.

## Decision

**데이터 주도 `ResourceMeta` 패턴 그대로 두 리소스를 추가한다(리소스 29→31).**

- **`ecr`** — category `storage`, `allowedParents: ['canvas']`(리전 서비스),
  `connectsTo: ['ecs','eks']`(이미지 pull). 필드: 푸시 스캔·태그 불변성.
  Terraform: 자기완결적 `aws_ecr_repository`(scan_on_push·image_tag_mutability).
- **`cloudtrail`** — category `management`, `allowedParents: ['canvas']`(계정 레벨),
  `connectsTo: ['s3']`(로그 전달 대상). 필드: 멀티리전·로그 파일 검증.
  Terraform: `aws_cloudtrail`(`s3_bucket_name`은 `cloudtrail → s3` 엣지에서 해석한
  `refs.logBucket`) + **파생 배선**으로 CloudTrail 서비스에 `GetBucketAcl`/`PutObject`를
  부여하는 `aws_s3_bucket_policy`(+`data.aws_caller_identity`) — 라우트 테이블처럼
  캔버스에 안 그려지는 필수 플러밍. 버킷 미연결 시 `REPLACE_ME`로 시끄럽게 표시.
- **시뮬레이션 제외**: ECR 이미지 pull과 CloudTrail 로그 전달은 요청 트래픽이 아니므로
  두 소스 타입을 `trafficEdges` 필터에서 제외(SG·CloudWatch·ACM·WAF·Cognito와 동일
  취급) — 유령 흐름을 만들거나 진입점을 오염시키지 않는다.
- **검증**: ECR은 컨테이너(ECS/EKS) 미연결 시, CloudTrail은 S3 미연결 시 경고
  ("no downstream target" 계열과 일관).

## Consequences

- **좋은 점**: 차니의 prod topology가 **드롭 0**으로 완전히 로드되고, 실제
  `terraform validate`를 통과하는 apply-ready HCL(ECR 레포·CloudTrail·버킷 정책 포함)을
  뽑는다. 팔레트에 두 블록 추가(storage·management).
- **나쁜 점 / 한계**: CloudTrail 버킷 정책은 단일 계정 경로만 emit한다(조직 트레일·
  KMS 암호화 트레일은 미모델 — 필요 시 후속). ECR 라이프사이클 정책·리플리케이션은
  미모델.
- **후속**: 자주 요청되는 다른 리소스(Transit Gateway 등)는 동일 패턴으로 추가 가능;
  관대한 불러오기(0061)가 그 전까지 우아하게 스킵한다.
