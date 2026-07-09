# 0054. Well-Architected 등급 — 4개 기둥 종합 점수 (+ EKS 비용 정정)

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0017](0017-security-model-and-severity-validation.md), [0026](0026-resource-expansion-2.md), [0051](0051-cost-budget-mode.md), [0052](0052-chaos-mode-fault-injection.md)

## Context

비용(0051)·카오스(0052/0053)로 "싸게 / 안 죽게" 축이 생겼다. 이 신호들을 **하나의 점수**로 묶어 자유 모드에 "등급을 올려라"는 목표를 주고, 게임 루프를 완성한다(재미 축 #3). 겸사겸사, EKS 비용이 컨트롤 플레인만 반영하고 **노드 그룹(워커 EC2)을 빠뜨린** 정확성 갭을 함께 정정한다.

## Decision

### Well-Architected 등급 — `graph/grade.ts`

`wellArchitectedGrade(nodes, edges)` → 4개 기둥(각 0–100) + 종합 + 레터. **기존 신호를 합성**하며, AWS 감사가 아닌 게임 밸런스 휴리스틱임을 명시한다.

- **🔒 보안** — `100 − 15 × (경고 있는 노드 수)`. checks.ts 경고(SG 미부착·암호화·SSH 개방·퍼블릭 DB 등) 재사용.
- **🛡 신뢰성** — 트래픽 도달 여부 + 카오스 기반: 서버리스(AZ 0개)면 85, VPC면 40 base + 멀티-AZ(+20) + DB 복원(Multi-AZ/복제본, +15) + **모든 단일-AZ 장애 생존**(+25, `applyAzFault`로 각 AZ 다운 시뮬). 오늘 만든 카오스가 여기서 점수화됨.
- **💰 비용** — 규모가 아니라 **효율**: 엣지 없이 방치된 고비용 리소스(ALB/RDS/EKS/ECS/ElastiCache)당 −25. 큰 아키텍처를 벌하지 않고 "안 쓰는데 돈 내는" 낭비만 감점.
- **⚡ 성능** — 가속기 존재 휴리스틱: base 55 + CloudFront(+15)·ElastiCache(+15)·읽기 복제본(+8)·ALB(+7).
- **종합** = 4개 평균 → 레터: S≥90 · A≥75 · B≥60 · C≥45 · D<45.
- **UI** — 캔버스 좌상단(비용 미터 아래) 실시간 배지: 레터 + 기둥 미니 점수, hover에 상세. 미션 판정·별점 불변(표시 전용).

### EKS 비용 정정 — `graph/cost.ts`

EKS 블록은 self-contained라 `aws_eks_node_group`(워커 EC2 2대)을 emit한다(ADR 0026). 비용을 **컨트롤 플레인 $73 + 2 × 노드 인스턴스 타입 비용**으로 정정(예: t3.medium → 73+60=133). "가장 무거운 블록"이 예산 미터에 제대로 드러난다.

## Consequences

- **게임 루프 완성** — 이중화·보안·저비용을 하나의 등급으로 종합. 자유 모드가 "S 등급 도전" 샌드박스가 됨. 오늘의 비용·카오스·checks 자산을 한 점수로 재사용.
- **정확한 EKS 비용** — 노드 그룹 포함으로 EKS가 실제만큼 비싸짐(노드 타입 키우면 비용↑). 미션 예산은 EKS 요구가 없어 회귀 없음.
- **무회귀** — 등급은 표시 전용(별점·Terraform 불변). 테스트 189→**194**(grade 4·cost EKS 2 갱신).
- **한계** — 성능/비용 기둥은 가벼운 휴리스틱(감사 아님). 신뢰성은 단일 AZ 장애 기준. 향후 기둥 가중치·다중 장애·운영 우수성 기둥 확장 가능.
