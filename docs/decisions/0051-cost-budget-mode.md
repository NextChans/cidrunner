# 0051. 비용 예산 모드 — 실시간 월 비용 추정 + 미션 예산 목표

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0014](0014-mission-clear-detection-and-stars.md), [0016](0016-apply-ready-terraform.md)

## Context

전 미션 클리어 후 "재미가 부족하다"는 피드백. 근본 원인은 게임 루프가 **"명세대로 조립 → ★3 → 끝"** 인 체크리스트라는 점 — 선택에 대가가 없고(어떤 리소스를 쓰든 도달만 하면 통과) 정답이 하나라 반복성이 없다. 재미는 **의미 있는 트레이드오프 + 체감되는 결과 + 반복성**에서 나온다.

가장 레버리지 큰 축으로 **비용(cost)**을 선택(차니 확정). 모든 배치를 최적화 퍼즐로 바꾸고("싸게 만들어라"), 실제 AWS 비용 감각(NAT/ALB/RDS/EKS가 시간당 과금되는 함정)을 학습시킨다.

## Decision

**리소스별 대략적 월 비용 추정 + 실시간 비용 미터 + 미션 예산 목표**를 추가한다(리소스 수·기존 판정 로직 불변).

### 비용 모델 — `graph/cost.ts`

- `RESOURCE_COST: Partial<Record<ResourceType, number | (cfg)=>number>>` — 타입별 대략적 USD/월. 값 또는 config 함수.
- 실제 함정을 반영: **NAT $32 · ALB $16 · EKS 컨트롤플레인 $73 · ECS $18**, EC2는 instance_type별(t3.micro $8 ~ m5.large $70), RDS는 instance_class별 × (multi_az ? 2 : 1), Kinesis는 mode/shard 기반. 플러밍·조직 박스(VPC/Subnet/IGW/SG/Account/AZ) = **$0**, 사용량 과금(S3/Lambda/DynamoDB/SQS/SNS/Cognito) = 소액 명목치.
- `estimateMonthlyCost(nodes)` → 반올림 합계. `nodeMonthlyCost(node)` → 노드별.
- **비용은 `ResourceMeta`가 아니라 `cost.ts` 한 곳**에 둔다: 리소스 고유 속성이 아니라 게임 밸런스 노브이므로, 튜닝이 한 파일에 모여야 한다.

### 미션 예산 — `Mission.budget?`

- 선택적 `budget?: number`(USD/월). 주요 미션에 설정: three-tier $60 · container $60 · secure-auth $60 · global-web $55 · disaster-recovery $50 · data-pipeline $20 · static-cdn/serverless $10.
- 예산은 **깨끗한 정답 빌드는 통과, 낭비(NAT 추가·과대 인스턴스)는 초과**하도록 잡음(테스트로 락인: three-tier clean $50 ≤ $60).
- **별 게이트를 바꾸지 않는다** — 예산은 자기부과 최적화 목표(표시 + 색). 기존 ★ 로직 무회귀. (게이트/점수로의 강화는 후속.)

### UI

- **캔버스 비용 미터**([Canvas.tsx](../../src/components/Canvas.tsx), top-left Panel): `💸 $Y/월`. 활성 미션에 예산이 있으면 `/ 예산 $X`와 ✓/⚠️, 예산 내=녹색·초과=빨강.
- **미션 카드**([MissionPanel.tsx](../../src/components/MissionPanel.tsx)): `💸 예산 $X · 현재 $Y (초과)` 라인.

## Consequences

- **최적화 루프 등장** — 자유 모드가 "싸게 만들기" 샌드박스가 되고, 미션은 "클리어했으면 이제 예산 안에서" 재도전 동기 부여. NAT/EKS 같은 함정이 미터에 즉시 드러남.
- **무회귀** — 별 판정·시뮬·Terraform 불변. 181개 테스트 green(신규 cost 4), 캐노니컬 12미션 3★ 유지. 예산은 표시 전용이라 기존 클리어에 영향 없음.
- **튜닝 용이** — 모든 비용이 `cost.ts` 한 곳. 값은 대략치임을 명시(빌링 계산기 아님).
- **후속 확장 여지** — 예산을 하드 게이트/보너스 배지/등급으로, 그리고 카오스 모드·Well-Architected 등급(다음 재미 축)과 합성 가능.
