# 0022. Resource expansion batch 1 — DynamoDB · CloudFront · Route 53 · SQS

- Status: Accepted (extends [ADR 0001](0001-mvp-scope-and-resource-list.md))
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

ADR 0001은 리소스를 10종으로 고정하고 "추가는 명시적 승인 + 별도 ADR"을 요구했다.
제품 미팅([2026-07-08](../meetings/2026-07-08-product-direction.md))에서 확장은
"안전망 → 저장 → 확장" 순서 조건부로 보류됐는데, 테스트 안전망(ADR 0021)과
Save & Share(ADR 0020)가 완료되어 전제가 충족됐고 확장이 승인됐다.

## Decision

**10종 → 14종.** 확장 비용(시뮬레이션 의미론·관계 검증·Terraform 배관)이 낮고
페르소나 수요가 높은 4종을 1차 배치로 추가한다. ECS/ElastiCache는 다음 배치로.

| 리소스 | 게임 역할 | 핵심 배선 |
| ------ | -------- | --------- |
| **DynamoDB** | 싱크 (RDS/S3와 동급) | `aws_dynamodb_table` (온디맨드/프로비저닝) |
| **CloudFront** | 진입점 — 오리진 앞단 | CF→ALB/S3/Lambda 엣지가 오리진 선택. S3 오리진은 OAI, ALB는 custom origin, Lambda는 API GW 도메인 |
| **Route 53** | 최상단 진입점 | R53→CF/ALB 엣지가 A-alias 레코드로 emit |
| **SQS** | 중간 홉 — 비동기 디커플링 | SQS→Lambda 엣지 = `aws_lambda_event_source_mapping` + 컨슈머 롤에 SQS 실행 정책 자동 부여 |

동반 변경:

- **진입점 일반화** — entry = {Route 53, CloudFront, ALB, Lambda} 중 **인바운드
  트래픽이 없는** 노드. CF가 ALB를 가리키면 ALB는 진입점이 아니라 홉이 된다.
- **싱크 확장** — RDS/S3에 DynamoDB 추가. EC2/Lambda의 `connectsTo`에
  DynamoDB/SQS 추가.
- **검증** — 오류: CF에 오리진 없음. 경고: R53 레코드 대상 없음, SQS 컨슈머 없음,
  내부 ALB를 CF 오리진으로 사용.
- **팔레트** — 새 카테고리 `앱 통합`(SQS). CF/R53은 네트워킹, DynamoDB는
  데이터베이스.
- **미션 2종 추가** — `글로벌 정적 웹`(R53→CF→비공개 S3; OAI 패턴이 핵심),
  `비동기 파이프라인`(Lambda→SQS→Lambda→DynamoDB).

14종 전체 토폴로지(53개 리소스)로 Terraform v1.9.8 `init`+`validate` 통과를
확인했고, 신규 시나리오는 단위 테스트 8건으로 고정했다(합계 36건).

## Consequences

- **좋은 점**: 요청 여정이 DNS부터 완성된다(R53→CF→ALB→EC2→RDS). 서버리스가
  실전 패턴(큐 파이프라인, CDN 정적 호스팅)으로 확장되고, 페르소나가 요구한
  SAA 단골 서비스가 채워진다.
- **나쁜 점 / 한계**: CF는 오리진 1개만(첫 엣지) 반영한다 — 다중 오리진/경로
  라우팅은 없다. R53은 존+A 레코드만 만들며 실제 도메인 위임은 사용자 몫이다.
  SQS DLQ, DynamoDB GSI는 미표현.
- **후속 영향**: ADR 0001의 "10종" 문구는 이 ADR로 대체된다(승인 절차는 유지).
  2차 배치(ECS/Fargate, ElastiCache 등)는 수요 확인 후 별도 ADR로.
