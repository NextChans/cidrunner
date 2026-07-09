# 0046. Lambda + API GW 콤보 분리 — 독립 API Gateway 리소스

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0001](0001-mvp-scope-and-resource-list.md), [0016](0016-apply-ready-terraform.md), [0022](0022-resource-expansion-batch-1.md)

## Context

MVP(ADR 0001)부터 Lambda 블록은 "Lambda + API GW" 콤보였다. 하나의 `lambda` 리소스가 `aws_lambda_function`과 함께 `aws_apigatewayv2_api`/`integration`/`route`/`stage`/`aws_lambda_permission`까지 한 번에 emit했다. 이 추상화는 서버리스 HTTP 엔드포인트를 한 블록으로 배우게 해 초기엔 단순했지만, 다음 한계가 누적됐다.

- **모델 부정확** — 실제 AWS에서 Lambda와 API Gateway는 별개 리소스다. SQS/Kinesis/SNS가 소비하는 Lambda(비동기·이벤트·데이터 파이프라인)는 API GW가 전혀 필요 없는데도 콤보가 강제로 HTTP API를 붙였다.
- **CloudFront 오리진 혼란** — CloudFront → Lambda 오리진이 `aws_apigatewayv2_api.<lambda>_api.api_endpoint`를 참조([QA 커버리지](../qa/2026-07-09-qa-report.md)에 미기재)해 "Lambda의 숨은 API GW"에 의존했다.
- **미션 표현력** — `서버리스 API` 미션이 "API Gateway를 Lambda에 연결"을 목표로 내걸지만, 정작 API Gateway 블록이 없어 Lambda를 놓기만 하면 통과했다(ADR 0036도 "독립 API GW 블록 부재"를 명시적 제약으로 기록).

F1.5/F2에서 이월된 P0.7 항목이다.

## Decision

`lambda`를 **함수 전용**으로 축소하고, **API Gateway(REST API)를 독립 리소스(`apigw`)로 신설**한다. 리소스 수 26 → **27**.

- **`lambda` refactor** — label `Lambda`, description `서버리스 함수`. Terraform emitter는 IAM 역할·로그 정책·(큐 소비 시)SQS 정책·archive zip·`aws_lambda_function`만 emit. API GW v2 블록 5개와 invoke permission 제거. output은 `_api_endpoint` → `_function_arn`.
- **`apigw` 신설** — label `API Gateway`, category `integration`(앱 통합), `allowedParents: ['canvas']`(리전 서비스, VPC 밖), `connectsTo: ['lambda']`. Config: `stage_name`(기본 `prod`), `endpoint_type`(regional/edge). Terraform 6블록 + invoke permission:
  - `aws_api_gateway_rest_api` · `aws_api_gateway_resource`(`{proxy+}`) · `aws_api_gateway_method`(`ANY`) · `aws_api_gateway_integration`(`AWS_PROXY`) · `aws_api_gateway_deployment` · `aws_api_gateway_stage`, 그리고 연결된 Lambda에 대한 `aws_lambda_permission`.
  - integration 타깃은 `apigw → lambda` 엣지에서 해석([terraform.ts](../../src/graph/terraform.ts) `integrationTarget`). Lambda 미연결 시 `REPLACE_ME` + 안내 주석으로 gap을 시끄럽게 표시(ADR 0044 원칙).
- **시뮬** — `apigw`를 `ENTRY_CAPABLE`에 추가. 흐름은 `apigw → lambda → sink`. `blockedMessage('apigw')` 신설.
- **CloudFront 오리진 재매핑** — `cloudfront.connectsTo`의 `lambda`를 `apigw`로 교체. 오리진 도메인은 `<rest_api>.execute-api.<region>.amazonaws.com` + `origin_path = "/<stage>"`. checks·simulate·terraform의 오리진 kind 목록도 `['alb','s3','apigw']`로 통일.

## 미션 마이그레이션 정책

콤보에 의존하던 4개 미션을 다음 원칙으로 갱신했다 — **"HTTP 진입이 본질인 미션만 API GW를 요구, 메시징/스트림 미션은 Lambda 단독 진입 유지."**

| 미션 | 이전 | 이후 | 근거 |
| --- | --- | --- | --- |
| **서버리스 API** | `lambda → s3` | `apigw → lambda → s3` (requiredResources에 `apigw` 추가, `check`는 `path[0]==='apigw'`) | 미션의 본질이 "API Gateway를 Lambda에 연결". 이제 실제 블록으로 학습. |
| **비동기 파이프라인** | `lambda → sqs → lambda → dynamodb` | 변경 없음 | 생산자 Lambda가 진입점. Lambda는 여전히 `ENTRY_CAPABLE`이라 콤보 없이도 그대로 클리어. HTTP 프론트는 스코프 밖. |
| **이벤트 드리븐** | `lambda → sns → sqs → lambda → dynamodb` | 변경 없음 | 동일 — Pub/Sub 패턴이 본질, API GW 불필요. |
| **데이터 파이프라인** | `kinesis → lambda → s3` | 변경 없음 | Kinesis가 진입점(ADR 0036). Lambda는 컨슈머 홉. |

즉 코드 변경이 필요한 미션은 **서버리스 API 1개**. 나머지 3개는 Lambda 단독 진입이 그대로 유효함을 회귀 테스트로 확인(락인).

## Consequences

- **리소스 27종** — types union·registry·palette·문서 일괄 갱신. Palette는 `integration` 그룹에 API Gateway 노출.
- **apply-ready 유지** — API Gateway는 연결된 Lambda로 완결된 `AWS_PROXY` 통합을 emit. 미연결은 `REPLACE_ME`로 표시되어 조용한 파손 없음(신규 테스트 2건).
- **회귀 없음** — best-practice 토폴로지의 bare Lambda(→S3)는 여전히 유효. 12개 미션 fixture 3★ 유지(serverless fixture만 `apigw` 노드 추가).
- **테스트** — terraform.test에 API GW 6블록+permission+output 검증 2건 추가, serverless fixture 갱신. Lambda의 apigatewayv2 잔재 부재 단언.
- **비용/트레이드오프** — CloudFront → Lambda 직결이 사라졌으나, 이는 원래 "Lambda의 숨은 API GW"에 의존한 부정확한 모델이었다. CloudFront → API Gateway → Lambda가 실제 AWS 구성과 일치.
