# 0036. Mission expansion batch 3 — 데이터 파이프라인 · 보안·인증 웹

- Status: Accepted (extends [ADR 0027](0027-mission-expansion-2.md), [ADR 0014](0014-mission-clear-detection-and-stars.md))
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

[ADR 0035](0035-resource-expansion-3-security-and-streaming.md)로 스트리밍(Kinesis)과
보안 스택(Cognito/Secrets/KMS/ACM/WAF)이 들어왔다. 새 리소스가 실제로 쓰이는
목표가 없으면 팔레트에만 존재하는 장식이 된다. Sprint E 목표: **최소 데이터 파이프라인
1개 + 보안 인증 웹 1개.**

## Decision

**10종 → 12종.** 두 미션을 추가한다.

| 미션 | id | 목표 (별 조건) |
| ---- | -- | -------------- |
| **데이터 파이프라인** | `data-pipeline` | Kinesis → Lambda → S3 도달. ★1 경로 도달 · ★2 설정 오류 0 · ★3 보안 경고 0 |
| **보안·인증 웹** | `secure-auth-web` | CloudFront → ALB → EC2 → RDS 경로 **+** Cognito·Secrets Manager·ACM·WAF 존재. ★1 경로+스택 · ★2 설정 오류 0 · ★3 보안 경고 0 |

설계 판단:

- **데이터 파이프라인**은 Kinesis를 진입점으로 삼는다. 계획서의 "API GW → Kinesis →
  Lambda → S3"에서 API GW 수집 단은 Kinesis 진입점으로 추상화했다(이 게임엔 독립
  API GW 블록이 없고 Lambda+API GW 콤보뿐). "실시간 스트림 처리(Lambda producer →
  Kinesis)"는 `lambda → kinesis` 엣지가 필요해 **기존 lambda 리소스 수정**을 요구하므로
  이번엔 채택하지 않았다(회귀 금지 원칙). 스트림 수집→처리→적재 한 갈래로 충분히
  파이프라인 개념을 전달한다.
- **보안·인증 웹**은 기존 글로벌 동적 웹([ADR 0027](0027-mission-expansion-2.md))의
  트래픽 골격(CF→ALB→EC2→RDS)에 보안 스택 **존재 조건**을 얹었다. Cognito/ACM/WAF는
  트래픽 엣지가 없으므로(ADR 0035), 별점은 "경로 도달 + 4종 배치"로 판정한다. ★3은
  RDS 프라이빗·암호화, SG 부착 등 기존 보안 경고 0 규칙을 그대로 재사용한다.
- 두 미션 모두 `requiredResources`로 팔레트 유도, `check(ctx)`는 시뮬레이션 결과 +
  검증 스윕을 재사용하는 [ADR 0014](0014-mission-clear-detection-and-stars.md) 패턴을
  그대로 따른다. 기존 10종 미션의 clear 로직은 무변경.

## Consequences

- **좋은 점**: 새 리소스 6종 중 Kinesis·Cognito·Secrets·ACM·WAF가 모두 최소 1개
  미션에서 목표로 등장한다. 데이터 파이프라인은 스트리밍 카테고리의 첫 미션이고,
  보안·인증 웹은 "프로덕션급 인증 웹"이라는 실전 시나리오를 준다.
- **나쁜 점 / 한계**: 보안·인증 웹은 Cognito/ACM/WAF를 **존재만** 확인한다(트래픽
  결합 미검증) — ADR 0035의 격리 결정에 따른 불가피한 한계. "실시간 스트림 처리
  (Lambda→Kinesis)" 미션은 lambda `connectsTo` 확장이 가능해지는 후속 배치로.
- **후속 영향**: 미션 12종. 이벤트 소스가 늘면(Firehose·데이터 레이크) 파이프라인
  갈래를 확장할 수 있다.
