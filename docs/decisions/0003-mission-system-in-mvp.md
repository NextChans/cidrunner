# 0003. Mission system in the MVP

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

제품 방향으로 세 갈래를 검토했다: (A) 편집기 + Terraform export만, (B) 트래픽
시뮬레이션 추가, (C) 레벨/미션 클리어 게임. A만으로는 차니가 원한 "게임" 요구를
충족하지 못하고, C(레벨 클리어) 없이는 결국 아키텍처 **시각화 툴**에 가까워진다.
React Flow 채택으로 톱니 블록의 장난감 느낌이 사라졌으므로
([ADR 0002](0002-react-flow-over-blockly.md)), 게임성을 채울 요소가 필요했다.

## Decision

**미션 시스템**을 MVP에 포함한다. 초기 미션 3개(tutorial / 3-tier / serverless)를
제공하고, **Free mode**(자유 샌드박스)와 **Challenge mode**(미션)를 토글하는
구조를 둔다. 미션은 `goal`·`hint`·`requiredResources`를 갖는 데이터로 정의한다.

## Consequences

- **좋은 점**: 학습 곡선(튜토리얼)과 게임적 성취감(클리어·별점)을 제공한다.
  Free/Challenge 토글로 게임과 툴 양쪽 사용성을 확보한다.
- **나쁜 점**: 미션 콘텐츠 유지보수 부담과, 미션 clear 판정 로직으로 인한
  추가 복잡도가 생긴다.
- **후속 영향**: 미션 클리어 판정은 트래픽 시뮬레이터(Phase 3) 위에 얹히며,
  전체 미션 흐름은 Phase 5에서 완성된다. 미션은 `src/missions/` 레지스트리로
  관리한다.
