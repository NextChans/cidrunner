# 0064. draw.io 내보내기 — 설계를 .drawio(AWS4 셰이프)로

- Status: Accepted
- Date: 2026-07-10
- Deciders: 차니, Claude

## Context

차니 요청: "drawio 파일을 import 하거나 export 하는 것도 추가 가능해?" 평가 후
`AskUserQuestion`에서 **Export만** 선택. import은 drawio가 자유 형식이라 셰이프
휴리스틱 매칭 + deflate 압축 해제가 필요하고 저충실도라 유보했다. export는 우리
그래프(타입·부모상대 좌표·containment·엣지)가 이미 필요한 정보를 다 가져 결정적이다.

## Decision

**`generateDrawio(nodes, edges, securityGroups)`로 비압축 `<mxfile>` XML을 생성한다
(Terraform 생성기와 같은 패턴).**

- 각 노드 → `mxCell`. 컨테이너(Account/VPC/AZ/Subnet)는 `container=1` 그룹
  셰이프(`mxgraph.aws4.group` + grIcon; AZ는 전용 아이콘이 없어 점선 영역), 리프는
  `shape=mxgraph.aws4.resourceIcon;resIcon=…`에 카테고리별 배경색.
- **좌표·containment 무손실**: mxGeometry는 부모 상대(React Flow와 동일)라 `position`을
  그대로, `parent`는 `n-<parentId>`로 매핑. 부모가 자식보다 먼저 나오도록 깊이순 정렬.
- 엣지 → orthogonal `mxCell edge`(source/target = `n-<id>`). 끝점이 없는 엣지는 스킵.
- **SG는 노드가 아니므로(ADR 0059)** 각 리소스 라벨에 `🛡 <sg 이름들>`을 덧붙여 정보
  보존. 라벨은 XML 이스케이프.
- 비압축 XML → draw.io·diagrams.net·VS Code drawio 확장·Confluence에서 바로 열림.
  의존성 0(브라우저 내장 문자열/Blob), 정적 호스팅 유지.

## Consequences

- **좋은 점**: 설계를 표준 다이어그램 도구로 가져가 문서화·리뷰·공유할 수 있다.
  차니의 36노드 topology → 36 vertex·19 edge의 유효한 `.drawio`(XML 파서 통과) 확인.
- **나쁜 점 / 한계**: **export 전용**(import 미지원). `resIcon`/`grIcon` 이름이 drawio
  라이브러리와 미세하게 어긋나면 해당 셰이프는 라벨 박스로 폴백(치명적 아님) —
  실기기 draw.io 렌더는 사용자 환경에서 확인 필요. 트래픽 방향 엣지만 표현(SG는 라벨).
- **후속**: 필요 시 import(휴리스틱 셰이프 매핑 + pako 압축 해제, 저충실도)나 아이콘
  이름 미세조정.
