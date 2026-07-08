# 0019. RDS read replica as a replication edge

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

RDS 블록은 `multi_az`(장애 조치용 스탠바이)만 표현할 수 있었고, 읽기 확장을 위한
**Read Replica**는 표현이 불가능했다. 복제본을 별도 리소스 타입으로 추가할 수도
있지만, MVP 리소스 10종 고정([ADR 0001](0001-mvp-scope-and-resource-list.md))을
깨고 레지스트리를 부풀린다.

## Decision

**복제를 엣지로 표현한다: RDS(소스) → RDS(복제본).**
SG 어태치먼트 엣지(ADR 0017)와 같은 문법으로, 새 블록 없이 관계만 추가한다.

- **규칙** — `rds.connectsTo = ['rds']`. 이를 위해 `canConnect`의 동일 타입 차단을
  제거하고, 자기 자신 연결과 "복제본의 소스는 1개" 제약은 캔버스 onConnect에서
  막는다.
- **시각화** — 복제 엣지는 남색 점선(트래픽 아님·시뮬레이션 제외), 복제본 노드에는
  `REPLICA` 배지가 붙는다.
- **Terraform** — 복제본은 `replicate_source_db = aws_db_instance.<src>.identifier`
  로 emit되고, AWS가 거부하는 속성(username/password/engine/allocated_storage/
  db_subnet_group)은 생략한다(소스에서 상속). `db_password` 변수와 DB Subnet
  Group은 **프라이머리 기준으로만** 생성된다.
- **검증** — 오류: 복제본 엔진이 소스와 다름. 경고: 복제본이 소스와 같은 AZ
  (읽기 복제본의 존재 이유가 AZ 분산이므로).

## Consequences

- **좋은 점**: 블록 추가 없이 실제 AWS 개념(multi_az 스탠바이 vs 읽기 복제본)이
  구분되어 표현된다. 엣지 문법이 SG 어태치먼트와 일관된다. 생성물은
  `terraform validate`를 통과한다(프라이머리+복제본 토폴로지로 확인).
- **나쁜 점 / 한계**: 복제본 승격(promotion), 크로스 리전 복제, 계단식 복제 체인
  검증은 다루지 않는다. 트래픽 시뮬레이션은 여전히 복제본으로의 읽기 분산을
  표현하지 않는다(엣지가 트래픽이 아니므로).
- **후속 영향**: 읽기/쓰기 분리 시뮬레이션이 필요해지면 SimFlow에 read-path를
  추가하는 후속 ADR로 다룬다.
