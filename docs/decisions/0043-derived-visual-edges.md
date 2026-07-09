# 0043. 파생 시각 엣지 — 엔진 소유 IGW → 퍼블릭 Subnet 점선

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0039](0039-igw-internet-ingress-simulation.md)

## Context

[ADR 0039](0039-igw-internet-ingress-simulation.md)에서 IGW를 **시뮬레이션 인그레스 게이트**로
반영했지만(인터넷 → IGW → 퍼블릭 subnet → ALB), IGW는 캔버스에서 여전히 **시각적으로 고립된 섬**
이었다 — 어떤 엣지도 그것을 퍼블릭 subnet에 연결하지 않아 역할이 안 보였다. 라우팅은 IGW의
존재에서 **파생**되는 것이지 플레이어가 그리는 트래픽이 아니므로, 이를 user-drawn 엣지로 만들 수는
없다(오염·삭제 가능성).

## Decision

**엔진 소유 파생 엣지** 프레임워크를 도입한다([`src/graph/derived.ts`](../../src/graph/derived.ts)).

- `derivedEdges(nodes)`가 그래프의 plumbing에서 엣지를 **계산**한다. 현재 규칙: VPC 자식인 IGW →
  같은 VPC 안 모든 **퍼블릭** subnet으로 엣지(`0.0.0.0/0 → IGW` 기본 라우트 표현).
- 이 엣지들은 **저장되지 않고**(persist·share·undo 대상 아님) **편집 불가**다
  (`selectable/deletable/focusable/reconnectable = false`, id 접두어 `derived-`).
- 캔버스는 렌더링 시점에만 `[...userEdges, ...derivedEdges(nodes)]`로 합쳐 그린다 —
  `onEdgesChange`는 계속 user 엣지에만 작동하므로 상태 오염이 없다.
- 렌더러 [`DerivedEdge`](../../src/components/edges/DerivedEdge.tsx)는 트래픽/부착 엣지와 구별되도록
  **얇은 subtle slate(#94a3b8) 점선**으로 그리고, 넓은 투명 히트영역 + 네이티브 `<title>`로
  hover 툴팁 "라우팅 (0.0.0.0/0 → IGW)"을 제공한다.

프레임워크는 범용이라 향후 다른 파생 관계(예: RDS → subnet group, EFS → mount target)도 이
방식을 재사용한다.

## Consequences

- IGW의 역할이 캔버스에서 즉시 보인다(퍼블릭 subnet으로 향하는 점선).
- user-drawn 엣지 모델이 오염되지 않는다(파생은 렌더 전용, 엔진 소유).
- [derived.test.ts](../../src/graph/__tests__/derived.test.ts)가 규칙을 락인: 퍼블릭에만 연결,
  프라이빗 제외, VPC 경계 넘지 않음, VPC 밖 IGW는 무출력, 편집 불가 플래그.
- 시뮬레이션(ADR 0039)과 시각(이 ADR)이 이제 같은 IGW 사실을 두 층에서 일관되게 표현한다.
