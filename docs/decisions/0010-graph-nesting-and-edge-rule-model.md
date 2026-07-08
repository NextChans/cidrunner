# 0010. Graph nesting & edge rule model

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

Phase 1은 캔버스를 편집 가능하게 만드는 단계다. 리소스를 팔레트에서 드래그해
배치하고, 올바르게 중첩하며(VPC ▸ Subnet ▸ EC2/RDS …), 엣지를 방향·타입 규칙으로
제약해야 한다. 문제는 이 규칙들을 **어디에 어떻게 표현하느냐**이다.

두 가지 선택지가 있었다.

1. 컴포넌트(Canvas 등)에 `if (type === 'ec2') …` 형태로 규칙을 하드코딩한다.
2. 규칙을 데이터로 선언해 리소스 레지스트리에 두고, 컴포넌트는 그 데이터를 읽기만
   한다.

[ADR 0001](0001-mvp-scope-and-resource-list.md)에서 리소스 레지스트리를 데이터
기반으로 유지하기로 했고, [CONTRIBUTING](../CONTRIBUTING.md)도 "리소스별 분기보다
`ResourceMeta` 확장을 선호"하도록 못박았다. ADR 0001은 또한 중첩 규칙이 정해지면
별도 ADR로 남기라고 예고했다 — 이 문서가 그 ADR이다.

## Decision

규칙을 **데이터 기반**으로, `ResourceMeta`의 필드로 선언한다.

- `allowedParents: (ResourceType | 'canvas')[]` — 이 리소스가 놓일 수 있는 위치.
  `'canvas'`는 최상위(부모 없음)를, `ResourceType`은 해당 타입 안에 중첩됨을 뜻한다.
  `'canvas'`가 없는 리소스는 반드시 컨테이너 안에 있어야 한다.
- `container?: boolean` + `defaultSize` — 자식을 담는 컨테이너(VPC·Subnet)인지와
  생성 시 크기.
- `connectsTo?: ResourceType[]` — 이 리소스에서 **방향성** 엣지를 그릴 수 있는 대상.
  `source → target` 연결은 `source`의 `connectsTo`에 `target`이 있을 때만 허용된다.

파생 로직은 `src/graph/rules.ts`에 모은다: `canContain` / `canBeTopLevel` /
`canConnect` / `canBeSource` / `canBeTarget` / `requiredParentLabel`. 컴포넌트는
이 함수들만 호출하고 리소스별 분기를 갖지 않는다.

MVP 10종의 규칙 요약:

| 리소스 | allowedParents | container | connectsTo |
| ------ | -------------- | --------- | ---------- |
| VPC    | canvas         | ✅         | —          |
| Subnet | vpc            | ✅         | —          |
| IGW    | vpc            |           | —          |
| NAT    | subnet         |           | —          |
| SG     | vpc            |           | —          |
| ALB    | vpc            |           | ec2, lambda |
| EC2    | subnet         |           | rds, s3    |
| RDS    | subnet         |           | —          |
| S3     | canvas         |           | —          |
| Lambda | canvas         |           | rds, s3    |

배치·연결 위반은 UI를 막는 대신 **일시적 한국어 알림(notice)**으로 피드백한다.
드롭 시에는 포인터 아래의 가장 안쪽(면적 최소) 유효 컨테이너를 부모로 선택하고,
없으면 최상위 허용 여부에 따라 배치하거나 거부한다.

## Consequences

- **좋은 점**: 규칙이 한곳(리소스 메타 + `rules.ts`)에 모여 읽기 쉽고, 리소스를
  추가·수정할 때 컴포넌트를 건드릴 필요가 없다. Phase 3(시뮬레이션)·Phase 4
  (Terraform 의존성 해석)가 같은 데이터를 재사용할 수 있다.
- **나쁜 점 / 한계**: 현재 모델은 "누가 누구 안에 들어가는가"와 "누가 누구에게
  연결되는가"만 표현한다. 개수 제한(예: 서브넷당 NAT 1개)이나 조건부 규칙
  (퍼블릭 서브넷에만 IGW 경로)은 아직 표현하지 못한다.
- **후속 영향**: React Flow의 `extent: 'parent'`에 의존해 자식이 부모 밖으로
  드래그되지 않도록 한다. 컨테이너 간 재배치(다른 VPC로 서브넷 이동 등)는 이번
  범위에서 제외했고, 필요해지면 확장한다. 규칙 표현력을 늘릴 경우 이 ADR을
  갱신하거나 후속 ADR로 대체한다.
