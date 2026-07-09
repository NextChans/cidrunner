# 0056. 보안 attachment 배선(HTTPS·WAF·인증)과 프로덕션 준비도 manifest

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0016](0016-apply-ready-terraform.md), [0017](0017-security-model-and-severity-validation.md), [0035](0035-resource-expansion-3.md), [0046](0046-lambda-apigw-split.md), [0055](0055-terraform-apply-wiring.md)

## Context

ADR 0055(🅰) 직후, 차니가 후속 리뷰에서 **분류 축의 오류**를 지적했다. 나는 🅰/🅱 경계를 사실상 **구현 노력**으로 긋고 이를 "게임 추상화 경계"인 것처럼 프레이밍했다. 그러나:

- #3(ACM→ALB HTTPS)·#4(WAF association)·#5(Cognito authorizer)는 **블록이 이미 존재**한다. 추상화 밖(#7 감사로그처럼 블록 자체가 없음)이 아니라 **모델 확장 가능** 계층이다.
- 특히 **#3이 가장 위험**하다: #1(SG)은 틀리면 헬스체크가 터져 시끄럽게 실패하지만, HTTP-only ALB는 **조용히 성공**한다. 게다가 현재 ACM cert는 emit되지만 아무 리스너에도 안 물려 **PENDING_VALIDATION 좀비 리소스**로 남는다 — cert의 존재가 "TLS 처리됨"이라는 잘못된 신호를 준다(attractive nuisance). 실패보다 나쁜 "그럴듯한 오배선".

정정된 경계는 **노력이 아니라 도구의 실제 능력**이다:

| 계층 | 항목 | 처리 |
|---|---|---|
| 순수 codegen (ADR 0055에서 완료) | #1 #2 #8 #11 | 기존 엣지 재사용 |
| **모델 확장 가능 (이 ADR)** | **#3 #4 #5** | 엣지 신설 + codegen |
| 외부 입력/토폴로지 변경 | alarm_actions, #9/#10 per-AZ RT | 후속 |
| 진짜 추상화 밖 | #7 감사로그, CloudFront 멀티리전 cert | **manifest로 고지** |

## Decision

### 1. 보안 attachment 엣지 (SG 패턴 확장)

ACM·WAF·Cognito는 지금까지 엣지가 없어 캔버스에 떠 있었다(ADR 0035). 이는 시뮬레이션 진입점(ALB/APIGW)을 보존하려는 의도였다. **SG와 동일하게 attachment 엣지**(source=보안 블록, traffic 아님)로 모델링해 두 목표를 동시에 만족한다:

- `acm.connectsTo = ['alb']` — `acm → alb`는 그 ALB를 TLS로 보호.
- `waf.connectsTo = ['alb', 'apigw']` — `waf → target`은 Web ACL 연결.
- `cognito.connectsTo = ['apigw']` — `cognito → apigw`는 그 API의 authorizer.

`simulate.ts`의 traffic 필터가 `acm`/`waf`/`cognito` 소스를 SG처럼 제외 → **대상은 여전히 진입점**으로 유지되고, 시뮬레이션·별점·기존 성공 케이스 전부 불변.

### 2. codegen 배선

- **#3 ACM→ALB**: cert 부착 시 ALB가 TLS 종료 — **HTTPS:443 리스너**(`certificate_arn`, TLS13 정책) + **HTTP:80 → 301 redirect**. 좀비 cert 제거. 미부착이면 기존 HTTP 리스너 유지(manifest가 고지).
- **#4 WAF association**: `waf → alb|apigw` 엣지마다 `aws_wafv2_web_acl_association` 유도(ALB=ARN, REST API=stage ARN). scope=REGIONAL이라 ALB·API GW만 유효.
- **#5 Cognito authorizer**: pool 부착 시 `aws_api_gateway_authorizer`(COGNITO_USER_POOLS) + 메서드 `authorization = "COGNITO_USER_POOLS"`. 미부착이면 `NONE` 유지(manifest 고지).

### 3. `PRODUCTION-READINESS.md` manifest

export zip에 **머신리더블 준비도 manifest**를 항상 동봉한다. "apply된다 ≠ 프로덕션 레디"의 긴장을 마케팅 문구가 아니라 **산출물에** 박는다. 그래프에서 결정론적으로:

- **미배선 보안 블록**(유도 가능하나 사용자가 미연결): cert 없는 ALB(`alb-plaintext-http`), authorizer 없는 API GW(`apigw-open-auth`).
- **구조적 스코프 밖**(선언): 앱→시크릿 소비 미배선(`app-secret-consumption`), AWS 관리형 KMS(CMK 아님, `aws-managed-kms`), 감사로그 없음(`no-audit-logging`), CloudFront TLS/WAF 멀티리전(`cloudfront-tls-waf-unwired`), alarm 액션 없음(`alarms-no-action`), 단일 NAT SPOF(`single-nat-spof`).

각 항목은 `id`·`severity`·`title`·`detail` + `json` 요약 블록.

## Consequences

- **정직함이 산출물에 박힌다** — "학습 도구냐 프로덕션 청사진이냐"의 이분법 대신, **scope 안은 fail-safe, scope 밖은 스스로 시끄럽게 고지**하는 프로토타이핑 도구로 정체성 확정.
- **좀비 cert 제거** — cert를 그리면 실제로 HTTPS가 물린다.
- **경계가 능력으로 고정** — 다음 리뷰가 와도 "노력"이 아니라 "모델이 표현 가능한가"로 판단.
- **무회귀** — 198개 테스트 green. 신규: TLS/WAF/Cognito 배선, 0.0.0.0/0-부재 네거티브 가드, manifest. `expansion-3` 테스트는 ADR 0035의 "no-edges" 전제를 이 ADR로 대체.
- **후속(여전히 밖)**: alarm_actions·per-AZ RT는 외부 입력/토폴로지 변경 필요 → 별도 판단. #7·멀티리전 cert는 manifest 고지로 종결.
- **앱 시크릿 소비**: `manage_master_user_password`로 tfstate 평문은 없앴으나, EC2/EKS가 secret ARN을 읽을 IAM/주입은 토폴로지 스코프 밖 → manifest에 명시. CMK(`master_user_secret_kms_key_id`)도 동일.
