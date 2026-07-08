# 0002. React Flow over Blockly

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

차니의 원래 아이디어는 "코딩 블록 게임"으로, Scratch나 Blockly의 톱니 모양
블록을 끼워 맞추는 UI를 연상했다. 그러나 AWS 네트워크 구조는 위에서 아래로
끼워지는 **트리(tree)** 가 아니라, 리소스들이 서로 참조하는 **그래프(graph)** 다.
ALB → EC2 → RDS 같은 연결과 VPC 안의 Subnet 안의 EC2 같은 중첩을 톱니 블록으로
표현하면 부자연스럽다. 편집기 기반 기술로 Blockly 계열과 노드 그래프 에디터
(React Flow) 중 무엇을 쓸지 결정해야 했다.

## Decision

Blockly 대신 **React Flow (`@xyflow/react`)** 를 채택한다. 노드/엣지 편집기의
사실상 표준이며, 컨테이너 중첩(`parentId` + `extent: 'parent'`)을 기본 지원한다.

## Consequences

- **좋은 점**: 그래프 표현이 자연스럽다. Subnet 안에 EC2를 넣는 중첩이 기본
  기능으로 지원되고, 미니맵·줌·팬·엣지 라우팅을 공짜로 얻는다.
- **나쁜 점**: 톱니 블록 특유의 "장난감 같은" 재미 요소는 사라진다.
- **후속 영향**: 게임성 결핍은 **미션 시스템**으로 보강한다
  ([ADR 0003](0003-mission-system-in-mvp.md)). 노드 렌더링은 단일
  `ResourceNode`가 `ResourceMeta` 기반으로 처리한다.
