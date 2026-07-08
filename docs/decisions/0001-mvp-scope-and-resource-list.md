# 0001. MVP scope & resource list

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

AWS는 200개가 넘는 서비스/리소스를 제공하며, 이를 전부 블록으로 구현하는 것은
개인 프로젝트 범위에서 불가능하다. 과거 autostock 프로젝트에서 스코프를 무한히
부풀리다 완성하지 못한 경험이 있어, 이번에는 처음부터 **완성 가능한 최소 범위**를
못박아 두어야 한다. 문제는 "어디까지가 데모로서 의미 있는 최소 집합인가"이다.

## Decision

MVP 리소스를 **10종**으로 고정한다:

VPC · Subnet · IGW · NAT · Security Group · ALB · EC2 · RDS · S3 · Lambda(+API GW).

이 10종은 3-tier 웹 아키텍처와 서버리스 아키텍처 데모를 모두 커버한다. 이 목록을
벗어나는 리소스 추가는 **명시적 승인 없이 금지**한다.

## Consequences

- **좋은 점**: 완성 가능성이 크게 올라간다. 3-tier / serverless 미션을 모두 표현할
  수 있어 데모로서 충분하다. UI·검증·Terraform 생성 로직이 10종 안에서 닫힌다.
- **나쁜 점 / 한계**: IAM, CloudFront, DynamoDB, SNS/SQS, Route 53 등은 미지원이다.
  실제 아키텍처를 그대로 옮기기에는 부족하다.
- **후속 영향**: 확장 여지는 남겨둔다. 리소스 레지스트리(`src/resources/`)가
  데이터 기반이라 새 `ResourceMeta`를 추가하면 확장되지만, 추가는 별도 ADR로
  승인 후 진행한다.
