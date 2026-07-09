# 0050. AWS Account · Availability Zone 조직 컨테이너 + 컨테이너 상속

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0001](0001-mvp-scope-and-resource-list.md), [0010](0010-graph-nesting-and-edge-rule-model.md), [0015](0015-graph-level-cidr-validation.md), [0040](0040-containment-audit-normalize-feedback.md)

## Context

토폴로지 표현이 VPC를 최상위로, Subnet을 VPC 직속으로 두는 2단 컨테이너(VPC ▸ Subnet)에 머물러 있었다. 실제 AWS 멘탈 모델에는 그 위/사이에 **계정(Account)** 경계와 **가용 영역(AZ)** 경계가 있다. 사용자 요청:

1. **AWS Account 박스** — VPC들을 담는 조직 경계.
2. **AZ 박스** — Subnet들을 담고, 하위 리소스가 AZ 값을 물려받는 경계.
3. **컨테이너 상속** — 박스 하위 리소스가 상위 설정을 **디폴트로** 물려받음(VPC CIDR 경계 → Subnet CIDR, AZ 박스 az → Subnet az). 단 **인스펙터에서 개별 변경 가능**.

## Decision

리소스 27 → **29**. `account`·`az` 두 조직 컨테이너를 신설하되, 아래 3개 판단(차니 확정)을 따른다.

### 1. 가산적 계층 (기존 fixture 무변경)

```
AWS Account (canvas)         allowedParents: ['canvas']
  └─ VPC                     allowedParents: ['canvas', 'account']   ← 'account' 추가
       └─ Availability Zone  allowedParents: ['vpc']
            └─ Subnet         allowedParents: ['vpc', 'az']           ← 'az' 추가
                 └─ EC2/RDS/…
```

- **가산적**: VPC는 여전히 최상위에 둘 수 있고(‑ `'canvas'` 유지), Subnet은 여전히 VPC에 직접 둘 수 있다(‑ `'vpc'` 유지). 따라서 12개 미션 fixture·시드 그래프·기존 저장 설계는 **마이그레이션 불필요**.
- 규칙은 데이터 기반(`allowedParents`)이라 rules.ts·드롭 로직·`normalizeContainment`는 코드 변경 없이 새 중첩을 처리(innermost-allowed 컨테이너 선택 그대로).

### 2. 생성 시점 상속 (CIDR + AZ)

`graph/inherit.ts`의 `applyInheritedDefaults(node, nodes)`를 노드 **생성 경로**(`addNode`·`addNodeAt`)에서 호출:

- **Subnet** — 상위 체인의 VPC를 찾아 그 CIDR에서 **다음 빈 `/24`를 자동 배정**(형제 Subnet들이 쓰는 블록을 건너뜀 → 기본값 충돌 0). AZ 박스가 상위에 있으면 그 `az`를 상속.
- **AZ 박스** — 같은 VPC 내 형제 AZ 박스가 쓰지 않은 **다음 AZ 문자**(a→b→c…)를 기본값으로.
- 상속은 **생성 시 1회만** 적용하고 이후엔 건드리지 않는다 — 인스펙터에서 자유롭게 변경 가능(사용자 요구). 순수 함수라 단위 테스트로 락인.

### 3. 조직용 — Terraform 미생성

`account.terraform`·`az.terraform`은 `''`을 반환한다(빈 블록은 생성기에서 필터). 근거: **Account는 provider 자격증명/컨텍스트**이지 리소스가 아니며, **AZ는 Subnet의 속성**(`availability_zone`)이지 리소스가 아니다. AZ의 값은 하위 Subnet의 `az`(→ `availability_zone`)로 이미 반영된다. `account`/`az`는 emit 순서(`ORDER`)에 포함하되 산출물엔 나타나지 않는다.

### 정합성 수정

- `cidr.ts` — Subnet의 부모가 AZ 박스일 수 있으므로, containment/overlap 검사를 **직접 parentId → 상위 체인의 VPC**로 변경(`enclosingVpc`). AZ가 사이에 껴도 CIDR 범위·형제 겹침이 정확히 잡힌다.
- `terraform.ts`·`checks.ts`·`simulate.ts`의 VPC 탐색은 이미 부모 체인을 걷는 `vpcOf`/`ancestorOfType`이라 AZ 삽입에 투명(코드 변경 불필요).
- Palette: 두 박스 모두 `network` 카테고리, Account를 목록 선두·AZ를 Subnet 뒤에 배치.

## Consequences

- **리소스 29종** — types union·registry·palette·문서 갱신.
- **UX 개선** — Subnet을 여러 개 떨궈도 CIDR이 자동으로 다른 `/24`가 되어 기존의 "기본값 동일 → 즉시 overlap 에러" 마찰이 사라짐. AZ 박스로 멀티‑AZ 구성을 시각·의미적으로 묶을 수 있음.
- **회귀 없음** — 가산적 설계로 175개 테스트 green(신규 inherit 6·rules 1·cidr 2·terraform 1), 12개 미션 fixture 3★ 유지, 시드 그래프 무변경.
- **apply-ready 유지** — Subnet은 AZ 경유로도 VPC를 정확히 참조(`aws_vpc.<vpc>.id`), REPLACE_ME 없음.
- **한계(v1)** — 상속은 생성 시점에만. 노드를 다른 AZ 박스로 나중에 드래그해도 az는 자동 갱신되지 않음(인스펙터로 수정). Account는 VPC만 담음(다른 글로벌 서비스는 캔버스 유지). 향후 필요 시 확장.
