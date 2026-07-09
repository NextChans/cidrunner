# 0042. Security Group 부착 규칙 — sgAttachable 정정 · 경고 정합

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0017](0017-graph-validation-severity.md)

## Context

차니 리포트: **ECS Fargate ↔ SG 모순** — 경고에는 "연결된 Security Group이 없습니다"라고 뜨는데
SG에서 ECS로 엣지를 그으면 "허용되지 않는다"고 거부됐다. 상반된 두 메시지가 플레이어를 막았다.

원인은 두 규칙의 불일치였다:

- **엣지 규칙**(`sg.connectsTo`)은 `['alb', 'ec2', 'rds']`만 허용 → `canConnect('sg', 'ecs') = false`.
- **검증 규칙**([checks.ts](../../src/graph/checks.ts))은 `ecs`·`elasticache`·`efs`가 SG 없으면
  경고를 냈다.

즉 **경고 대상 ⊋ 부착 가능 대상** → ecs/elasticache/efs는 "SG를 붙여라"고 하면서 붙일 수 없었다.
container-workload 미션 테스트가 통과했던 건 fixture가 `sg → ecs` 엣지를 손으로 주입했기 때문이고,
실제 UI에서는 그릴 수 없었다.

## Decision

**불변식**: `sg.connectsTo`(부착 가능 집합) == checks.ts의 "SG 없음" 경고를 내는 집합.

VPC 안에서 ENI를 소유하는 리소스에만 SG를 부착한다:

| 리소스 | SG 부착 | 근거 |
| --- | --- | --- |
| EC2 · ALB · RDS | ✓ (기존) | ENI/엔드포인트가 VPC 안 |
| ECS Fargate | ✓ (추가) | task ENI |
| EKS | ✓ (추가) | 컨트롤플레인 + 노드 ENI |
| ElastiCache | ✓ (추가) | 캐시 노드 ENI |
| EFS | ✓ (추가) | mount target ENI |
| Lambda | ✗ | 이 게임은 Lambda를 **VPC 밖 캔버스 레벨**로 모델링(SG는 VPC 스코프) |
| NAT · IGW | ✗ | SG를 붙이지 않는 네트워크 프리미티브 |
| S3·DynamoDB·CloudFront·Route53·SQS·SNS·CloudWatch·Cognito·Secrets·KMS·ACM·WAF·Kinesis | ✗ | VPC 밖 리전/글로벌 서비스 |

구현:
- `sg.connectsTo = ['alb', 'ec2', 'rds', 'ecs', 'eks', 'elasticache', 'efs']`.
- checks.ts에 **EKS** "SG 없음" 경고 추가(ecs/elasticache/efs는 이미 있었음) → 경고 집합과
  부착 집합이 정확히 일치.
- 경고 문구는 통일된 "연결된 Security Group이 없습니다 (SG에서 엣지로 연결)."를 유지 — 이제
  모든 경고 대상이 실제로 부착 가능하므로 모순이 사라진다.

## Consequences

- ECS/EKS/ElastiCache/EFS에 SG를 그을 수 있고, 그리면 경고가 사라진다 → 모순 해소.
- [missions.test.ts](../../src/graph/__tests__/missions.test.ts)가 불변식을 락인: 부착 가능 집합과
  경고 집합의 일치, 비-VPC 리소스 부착 거부, SG 부착 시 경고 소거를 검증.
- Lambda의 SG 부착은 의도적으로 제외(모델 단순화). VPC Lambda 분리는 F3 스코프.
