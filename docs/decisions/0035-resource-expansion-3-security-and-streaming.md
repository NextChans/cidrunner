# 0035. Resource expansion batch 3 — Cognito · Secrets Manager · KMS · ACM · WAF · Kinesis

- Status: Accepted (extends [ADR 0026](0026-resource-expansion-2.md), [ADR 0022](0022-resource-expansion-batch-1.md), [ADR 0001](0001-mvp-scope-and-resource-list.md))
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

Sprint E(2026-07-09, 오늘 A–D 완주 후 후속 스프린트). 차니 리포트: 리소스 20종은
컨테이너·pub/sub·캐시까지는 채웠지만, **프로덕션 아키텍처의 필수 축인 인증·시크릿·
암호화·TLS·L7 방어가 통째로 비어 있다.** Cognito(앱 인증), Secrets Manager(DB/API
시크릿), KMS(암호화 키), ACM(TLS 인증서), WAF(OWASP/DDoS)는 실전에서 거의 모든
서비스에 붙는데 게임에 없다. 또 [ADR 0026](0026-resource-expansion-2.md)에서 "전용
미션과 소비 모델이 준비되는 후속 배치로" 미뤘던 **Kinesis**를 이번에 해소한다.

## Decision

**20종 → 26종.** 다음 6종을 추가하고, `security` 카테고리를 **보안·아이덴티티**로
재정의(라벨 변경)해 SG와 함께 계정 수준 보안/아이덴티티 서비스를 모은다.

| 리소스 | 카테고리 | 게임 역할 | 핵심 배선 / Terraform |
| ------ | -------- | -------- | --------------------- |
| **Cognito User Pool** | 보안·아이덴티티 | 앱 사용자 인증·회원 관리 | `aws_cognito_user_pool`(비밀번호 정책·MFA·이메일 검증) + `aws_cognito_user_pool_client`. 트래픽 엣지 없음(독립 아이덴티티) |
| **Secrets Manager** | 보안·아이덴티티 | DB/API 시크릿 저장·교체 | `aws_secretsmanager_secret`(컨테이너만, 값은 out-of-band). `secretsmanager → kms` 엣지 시 고객 관리 키로 암호화(`kms_key_id`) |
| **KMS Key** | 보안·아이덴티티 | 고객 관리형 암호화 키 | `aws_kms_key`(연 1회 자동 교체) + `aws_kms_alias`. 엣지 **타깃 전용**(Secrets Manager가 참조) |
| **ACM Certificate** | 보안·아이덴티티 | TLS 인증서 (ALB/CloudFront) | `aws_acm_certificate`(DNS/EMAIL 검증, `create_before_destroy`). 독립 |
| **WAF Web ACL** | 보안·아이덴티티 | OWASP·DDoS L7 필터 | `aws_wafv2_web_acl`(REGIONAL, `AWSManagedRulesCommonRuleSet` + IP 레이트 리밋). 독립 |
| **Kinesis Data Stream** | 앱 통합 | 실시간 데이터 스트림 | `aws_kinesis_stream`(온디맨드/프로비저닝) + `kinesis → lambda` 엣지가 event source mapping + Kinesis 실행 롤 생성 |

동반 변경:

- **진입점 확장** — Kinesis를 entry-capable로 추가한다. 아무것도 먹이지 않는
  스트림은 데이터 파이프라인의 머리(수집 → Lambda 컨슈머 → 싱크)로 시뮬레이션을
  시작한다. `kinesis → lambda` 엣지로 컨슈머를 잇는다.
- **비-트래픽 관계** — `secretsmanager → kms`는 암호화 키 참조로, 시뮬레이션 트래픽에
  영향이 없다(둘 다 entry-capable도 sink도 아님). Generator는 `refs.kmsKey`로 키
  로컬명을 해석해 `kms_key_id`에 주입한다.
- **표준 격리** — Cognito/ACM/WAF는 **트래픽 엣지를 선언하지 않는다.** ALB/CloudFront
  결합(WAF association·ACM listener·ALB Cognito 인증 액션)은 기존 리소스(alb/cloudfront)
  emit을 건드려야 하고 시뮬레이션 진입점 판정을 깨뜨릴 위험이 있어, 이번 범위에서는
  각 리소스를 **자기완결형 apply-ready**로 두고 결합은 학습자 몫으로 남긴다.
- **검증(경고)** — Kinesis 컨슈머 미연결 시 경고(SQS와 동일 패턴). Cognito 비밀번호
  최소 길이(6–99), KMS 삭제 대기(7–30), ACM 도메인 형식, WAF 레이트 리밋(100–20억)
  범위 검증.
- **팔레트** — `security` 카테고리 라벨을 **보안·아이덴티티**로 변경, 새 5종을 여기
  배치(SG와 동거). Kinesis는 **앱 통합** 재사용.
- **미션 2종 추가** — [ADR 0036](0036-mission-expansion-3-pipelines-and-auth.md) 참조.

### 왜 카테고리를 새로 만들지 않고 재정의했나

SG는 이미 `security` 카테고리에 있었다. KMS/ACM/WAF/Secrets는 보안, Cognito는
아이덴티티지만, 팔레트 그룹을 쪼개면 WAF·KMS가 "아이덴티티"에 어색하게 끼거나 보안이
둘로 갈린다. 카테고리 **키**(`security`)는 유지하고 라벨만 `보안·아이덴티티`로 넓혀
6종을 한 그룹에 모으는 편이 팔레트 스캔성과 타입 변경 최소화 모두에서 낫다.

### 왜 Cognito/ACM/WAF를 독립으로 뒀나

세 리소스의 "실전" 결합 대상은 모두 **기존 리소스**(ALB·CloudFront)다. WAF→ALB는
`aws_wafv2_web_acl_association`으로 가능하지만, WAF가 ALB로 트래픽 엣지를 그으면
`simulate`가 ALB를 "먹여지는 노드"로 보아 **진입점에서 탈락**시켜 A–D의 기존 웹
플로우가 깨진다. ACM listener·CloudFront `web_acl_id`는 alb/cloudfront emit 수정이
필요하다. 회귀 위험 대비 이득이 낮아, 각 리소스를 단독 apply-ready로 두고 결합은
후속 배치(진입점 판정 리팩터링과 함께)로 미룬다.

26종 신규 시나리오를 단위 테스트로 고정했다(리소스·미션·검색 합계 92→109건, TS
strict clean, `oxlint` clean, `vite build` 성공 — 최대 청크 198 kB, 500 kB 경고 없음).

## Consequences

- **좋은 점**: 인증(Cognito)·시크릿(Secrets Manager)·암호화(KMS)·TLS(ACM)·L7
  방어(WAF)까지 프로덕션 필수 보안 축이 채워졌다. Secrets→KMS로 "고객 관리 키" 관계를
  실제 HCL로 보여준다. Kinesis로 [ADR 0026](0026-resource-expansion-2.md)의 보류가
  해소되고 데이터 파이프라인 미션이 가능해졌다. 팔레트가 26종이 되며 `보안·아이덴티티`
  그룹이 AWS 콘솔 구성에 더 근접했다.
- **나쁜 점 / 한계**: Cognito/ACM/WAF는 캔버스에서 다른 리소스에 **시각적으로 붙지
  않는다**(독립 노드). WAF association·ACM listener·ALB Cognito 인증은 미표현. Secrets
  Manager는 값이 아닌 컨테이너만 생성(의도된 안전 설계). Kinesis 소비 모델은
  Lambda 단일 경로만(Firehose·Analytics·데이터 레이크 싱크는 미표현).
- **후속 영향**: 진입점 판정을 "비-트래픽 엣지" 일반화 수준으로 리팩터링하면
  WAF→ALB·ACM→ALB 결합을 회귀 없이 표현할 수 있다. Kinesis Firehose→S3(데이터 레이크),
  Cognito→ALB 인증 액션은 수요 확인 후 4차 배치로.
