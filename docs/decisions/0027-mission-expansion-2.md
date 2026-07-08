# 0027. Mission expansion batch 2 — 컨테이너 워크로드 · 글로벌 동적 웹 · 이벤트 드리븐 · 재난 복구

- Status: Accepted (extends [ADR 0003](0003-mission-system-in-mvp.md), [ADR 0014](0014-mission-clear-detection-and-stars.md))
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

Sprint B([meeting](../meetings/2026-07-09-standup-and-sprint-planning.md))에서 리소스
2차 배치([ADR 0026](0026-resource-expansion-2.md))와 함께 미션을 3~4종 확장한다. 기존
미션 6종(튜토리얼·3-tier·서버리스·정적CDN·비동기파이프라인·시큐리티하드닝)은 네트워크·
서버리스·보안에 치우쳐 있어, 새 리소스(컨테이너·SNS)와 카테고리 다양성(복원력·엣지)을
살리는 미션이 필요하다.

## Decision

**6종 → 10종.** 후보(재난복구·글로벌CDN·데이터레이크·이벤트드리븐·컨테이너) 중 4종을
추가한다. 데이터 레이크는 Kinesis 보류([ADR 0026](0026-resource-expansion-2.md))로 함께
미룬다.

| 미션 | id | Clear 조건(★1) | ★2 / ★3 |
| ---- | -- | ------------- | ------- |
| **컨테이너 워크로드** | `container-workload` | ALB → 컨테이너(ECS/EKS) → RDS 트래픽 도달 | ★2 설정 오류 0(멀티 AZ 포함) · ★3 보안 경고 0 |
| **글로벌 동적 웹** | `global-web` | Route 53 → CloudFront → ALB → EC2 → RDS 도달 | ★2 설정 오류 0 · ★3 보안 경고 0 |
| **이벤트 드리븐 팬아웃** | `event-driven` | Lambda → SNS → SQS → Lambda → DynamoDB 도달 | ★2 설정 오류 0 · ★3 보안 경고 0 |
| **재난 복구 (Multi-AZ)** | `disaster-recovery` | 기본 RDS + 읽기 복제본(rds→rds 엣지) 존재 | ★2 기본 Multi-AZ · ★3 복제본이 다른 AZ + 설정 오류 0 |

선정 근거:

- **컨테이너 워크로드** — 신규 ECS/EKS의 대표 사용처. ALB→컨테이너→RDS로 3-tier의
  컨테이너 변형을 학습.
- **글로벌 동적 웹** — 기존 `정적 CDN`(R53→CF→비공개 S3)과 대비되는 **동적** 패턴.
  CloudFront 오리진을 S3가 아닌 외부 ALB로 두어 DNS부터 DB까지 전 구간을 연결.
- **이벤트 드리븐 팬아웃** — 신규 SNS의 대표 사용처. 기존 `비동기 파이프라인`(SQS
  단독)에 SNS 팬아웃 한 단계를 더해 pub/sub → queue → worker 흐름을 학습.
- **재난 복구** — 신규 리소스 없이 기존 RDS 읽기 복제본([ADR 0019](0019-rds-read-replica-as-edge.md))과
  Multi-AZ를 조합한 **복원력** 미션. 별점이 Multi-AZ·크로스 AZ 배치를 유도.

ElastiCache·EFS·CloudWatch는 전용 미션 없이 자유 모드 콘텐츠로 둔다(모든 리소스가
미션을 가질 필요는 없음). Clear 판정은 기존 star 로직([ADR 0014](0014-mission-clear-detection-and-stars.md))을
그대로 쓰며, 4종 모두 3-star 클리어 + 미달 케이스를 단위 테스트로 고정했다.

## Consequences

- **좋은 점**: 미션이 컴퓨트(컨테이너)·엣지(동적 CDN)·통합(pub/sub)·복원력(DR)으로
  고르게 퍼져 게이머 경험이 확장된다. 신규 리소스가 "놓을 곳"을 얻는다.
- **나쁜 점 / 한계**: 컨테이너·글로벌 동적 웹 미션은 유효+보안 통과를 위해 노드 수가
  많아(≥9) 초심자에겐 무겁다 — 힌트로 완화. 재난 복구는 트래픽 시뮬 없이 토폴로지만
  검사한다(튜토리얼과 동일 패턴).
- **후속 영향**: 데이터 레이크 미션은 Kinesis 배치와 함께. SNS→CloudWatch 알람
  알림 미션도 후속 여지.
