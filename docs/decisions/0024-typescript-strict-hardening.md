# 0024. TypeScript strict 전면 적용 (noImplicitReturns · noUncheckedIndexedAccess)

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

Sprint A(부채 정리)의 첫 항목으로 TS strict 실적용 여부를 감사했다. `tsconfig.app.json`은
이미 `strict: true` + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`를
켜고 있었다. 즉 `noImplicitAny`·`strictNullChecks` 등 `strict` 묶음은 적용 중이었다.

그러나 배열/레코드/정규식 매치의 **인덱스 접근**은 여전히 `T`로 취급되고 있었다. 금융 도메인
습관상 "인덱스로 꺼낸 값은 없을 수 있다"를 타입으로 강제하는 `noUncheckedIndexedAccess`가
꺼져 있는 것은 실질적 부채였다. 예: `parseCidr`에서 `octets[0] << 24`, `checks.ts`/`cidr.ts`의
이중 루프 `vpcRanges[i]`, `simulate.ts`의 `arrivals[nodeId] > t` 등은 런타임엔 안전했지만
타입상 undefined 가능성이 검증되지 않았다.

## Decision

`tsconfig.app.json`과 `tsconfig.node.json` 양쪽에 두 플래그를 추가한다.

- **`noImplicitReturns: true`** — 무비용(에러 0건). 모든 분기가 값을 반환하도록 강제.
- **`noUncheckedIndexedAccess: true`** — 인덱스 접근 결과에 `| undefined`를 부여.
  활성화 시 48건 노출. `!` 남발로 뭉개지 않고 **실수정**한다:
  - `parseCidr`/`validateCidr`의 u32 조립을 `octets.reduce((acc,o)=>((acc<<8)|o)>>>0, 0)`로
    바꿔 인덱스 접근 자체를 제거.
  - `cidr.ts`/`checks.ts` 형제/VPC 이중 루프에 `if (!a || !b || ...) continue` 가드 추가.
  - `simulate.ts` arrivals는 `const prev = arrivals[nodeId]; if (prev === undefined || prev > t)`로
    `in` 체크 대신 값 기반 내로잉.
  - `lambda.ts`의 `INLINE_SOURCE['nodejs20.x']` fallback을 독립 상수 `NODEJS_SOURCE`로 승격해
    항상 정의된 기본값 보장.
  - `share.ts`/`MissionPanel.tsx`는 명시적 undefined 가드 / `?? 0`.
  - 테스트는 길이/존재를 이미 단언한 지점에 한해 `flows[0]!`·`files['main.tf']!` 사용.

## Consequences

- **좋은 점**: 인덱스·레코드 접근이 타입 수준에서 방어됨. `tsc -b` clean, Vitest 59건 통과,
  `vite build` 성공으로 회귀 없음 확인. 이후 신규 코드도 동일 기준을 강제받는다.
- **비용**: 배열 인덱스가 잦은 코드에서 가드/`!`가 늘어 약간의 소음. 소스에서는 로직 재구성
  (reduce·독립 상수)으로 최소화했고, 단언은 이미 존재가 보장된 테스트에 한정.
- **후속**: 향후 리소스/미션 추가 시(Sprint B) 새 emitter·check도 이 기준을 따른다.
  관련 문서-코드 동기화는 [ADR 0025](0025-terraform-apply-audit.md) 감사와 함께 정리.
