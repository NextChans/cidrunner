# 0044. ALB 서브넷 fallback 정리 — dead-path 명시화

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0016](0016-terraform-apply-ready.md)

## Context

[alb.ts](../../src/resources/alb.ts)의 Terraform 이미터는 인터넷 페이싱 ALB에 퍼블릭 subnet이
없을 때 조용히 **모든 subnet(프라이빗 포함)으로 fallback** 했다:

```ts
const subnetPool = config.internal
  ? refs.subnets
  : (refs.publicSubnets?.length ? refs.publicSubnets : refs.subnets)  // ← dead fallback
```

인터넷 페이싱 ALB는 반드시 퍼블릭 subnet에 있어야 하고, [checks.ts](../../src/graph/checks.ts)가
그 부재를 **이미 에러**로 잡는다. 따라서 이 fallback이 만드는 HCL은 "그럴듯하지만 절대 apply되지
않는" 잘못된 산출물이었고, ECS/EKS 이미터가 쓰는 `REPLACE_ME` 마커 관례와도 어긋났다.

## Decision

인터넷 페이싱 ALB는 `refs.publicSubnets`만 사용하고, 비어 있으면 프라이빗으로 fallback하지 않고
`['REPLACE_ME']` 마커를 낸다(내부 ALB도 subnet 풀이 비면 동일). ECS/EKS와 일관.

```ts
const subnetPool = config.internal ? (refs.subnets ?? []) : (refs.publicSubnets ?? [])
const subnets = (subnetPool.length ? subnetPool : ['REPLACE_ME']).map(...).join(', ')
```

## Consequences

- 유효한 외부 ALB(퍼블릭 subnet 보유)는 변화 없음 — `REPLACE_ME`가 나타나지 않는다(기존
  Terraform 테스트의 `not.toContain('REPLACE_ME')` 유지).
- 잘못된 구성은 산출물에서 즉시 눈에 띄고(플레이어에겐 checks.ts 에러로 먼저 안내됨), 정합성이
  개선된다.
- 규모가 작아 코드+주석+이 짧은 ADR로 마무리.
