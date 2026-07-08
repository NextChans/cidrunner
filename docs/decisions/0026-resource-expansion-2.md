# 0026. Resource expansion batch 2 — ECS · EKS · SNS · EFS · ElastiCache · CloudWatch

- Status: Accepted (extends [ADR 0022](0022-resource-expansion-batch-1.md), [ADR 0001](0001-mvp-scope-and-resource-list.md))
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

Sprint B(2026-07-09 스탠드업, [meeting](../meetings/2026-07-09-standup-and-sprint-planning.md))의
콘텐츠 확장 2차. ADR 0022가 14종으로 늘리며 "2차 배치(ECS/Fargate, ElastiCache 등)는
수요 확인 후 별도 ADR"로 남겨 뒀다. 게임 콘텐츠 다양성(컨테이너·pub/sub·캐시·공유
스토리지·관측성)이 부족하다는 판단으로 후보 7종(EKS, ECS, SNS, EFS, CloudWatch,
Kinesis, ElastiCache) 중 5~7종을 추가한다.

## Decision

**14종 → 20종.** 다음 6종을 추가하고 **Kinesis는 보류**한다.

| 리소스 | 카테고리 | 게임 역할 | 핵심 배선 |
| ------ | -------- | -------- | --------- |
| **ECS Fargate** | 컴퓨팅 | Lambda보다 무거운 컨테이너 워크로드 (VPC 내 컴퓨트 홉) | 자기완결형 `aws_ecs_cluster` + 실행 롤 + `aws_ecs_task_definition`(공개 nginx 이미지) + `aws_ecs_service`(Fargate, subnets·SG) |
| **EKS Cluster** | 컴퓨팅 | 관리형 쿠버네티스 (가장 무거운 블록) | `aws_eks_cluster`(≥2 AZ subnet, 컨트롤플레인 롤) + `aws_eks_node_group`(노드 롤 + 3개 관리형 정책) |
| **ElastiCache** | 데이터베이스 | 인메모리 캐시 — RDS의 짝, 데이터 티어 싱크 | `aws_elasticache_cluster`(redis/valkey, 단일 노드) + VPC별 `aws_elasticache_subnet_group` |
| **EFS** | 스토리지 | 다중 인스턴스 공유 파일 시스템 (싱크) | `aws_efs_file_system` + AZ당 1개 `aws_efs_mount_target` |
| **SNS Topic** | 앱 통합 | Pub/Sub 팬아웃 — SQS와 상보 | `aws_sns_topic` + sns→sqs/lambda 엣지가 구독 + 전달 권한(queue policy / lambda permission) 생성 |
| **CloudWatch** | 관리·모니터링(신규) | 관측성 — 로그·지표·알람 | `aws_cloudwatch_log_group` 항상 emit + cloudwatch→리소스 엣지가 대상별 `aws_cloudwatch_metric_alarm` |

동반 변경:

- **싱크 확장** — RDS/S3/DynamoDB에 **ElastiCache·EFS** 추가. 캐시·파일시스템도
  요청 여정을 종료한다. EC2/Lambda의 `connectsTo`에 SNS·ElastiCache(·EC2는 EFS) 추가.
- **진입점 확장** — ALB가 컨테이너(ECS/EKS)로 엣지를 그을 수 있고, 컨테이너는
  진입 가능 컴퓨트(entry-capable)로서 데이터 티어에 도달한다.
- **비-트래픽 엣지 일반화** — SG(부착)·RDS↔RDS(복제)에 이어 **CloudWatch(모니터링)**
  엣지도 시뮬레이션 트래픽에서 제외한다.
- **검증** — 오류: ElastiCache·EKS 단일 AZ(≥2 AZ 필요). 경고: SNS 구독 대상 없음,
  EFS 암호화 꺼짐, ECS/ElastiCache/EFS SG 미연결, CloudWatch 대상 없음.
- **팔레트** — 새 카테고리 **`관리·모니터링`**(CloudWatch). ECS/EKS는 컴퓨팅,
  ElastiCache는 데이터베이스, EFS는 스토리지, SNS는 앱 통합.
- **미션 4종 추가** — [ADR 0027](0027-mission-expansion-2.md) 참조.

### Kinesis를 뺀 이유

Kinesis는 스트림 수집만으로는 게임 의미가 약하고, 실전에서는 Firehose·Analytics·
데이터 레이크 싱크(S3/Redshift)와 함께여야 한다. "데이터 레이크" 미션 없이 단독
추가하면 캔버스에 놓아도 도달할 싱크가 없어 시뮬레이션이 항상 막힌다. 전용 미션과
스트림 소비 모델이 준비되는 후속 배치로 미룬다.

### 컨테이너의 Terraform 범위

ECS/EKS는 **자기완결형(self-contained)** 으로 emit한다. ALB→컨테이너 관계는 그래프
토폴로지·시뮬레이션 수준에서만 성립하고, Terraform은 컨테이너를 ALB 타깃 그룹에
자동 등록하지 않는다(EC2는 `instance` 타깃, Fargate는 `ip` 타깃이라 하나의 타깃
그룹에 섞으면 `target_type` 충돌). 컨테이너를 ALB 뒤에 실제로 붙이는 것은 사용자
몫(ECS는 서비스 `load_balancer` 블록, EKS는 AWS Load Balancer Controller)이며,
그럼에도 각 클러스터는 `terraform apply`로 단독 생성된다.

20종 신규 시나리오를 단위 테스트 15건으로 고정했다(합계 74건, TS strict clean,
`vite build` 성공).

## Consequences

- **좋은 점**: 컨테이너(ECS/EKS)·pub-sub 팬아웃(SNS)·캐시(ElastiCache)·공유
  스토리지(EFS)·관측성(CloudWatch)까지 SAA 단골 서비스가 대부분 채워진다. 새
  `관리·모니터링` 카테고리로 팔레트가 AWS 콘솔 구성에 더 가까워졌다.
- **나쁜 점 / 한계**: EKS는 apply-ready지만 HCL 분량이 크다(롤 2개 + 정책 4개 +
  클러스터 + 노드그룹). ECS/EKS는 ALB에 자동 연결되지 않는다(위 참조). ElastiCache는
  단일 노드(복제 그룹·클러스터 모드 미표현), SNS는 표준 토픽만(FIFO 미표현),
  CloudWatch 알람은 액션이 없다(SNS 알림 배선은 후속).
- **후속 영향**: ADR 0022의 "2차 배치는 별도 ADR" 조건이 충족됐다. Kinesis·데이터
  레이크·SNS→CloudWatch 알람 액션은 수요 확인 후 3차 배치로.
