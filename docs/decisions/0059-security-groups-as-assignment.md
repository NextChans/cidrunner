# 0059. 보안 그룹 재설계 — 엣지 부착에서 리소스 할당으로

- Status: Accepted
- Date: 2026-07-10
- Deciders: 차니, Claude (+ 4인 리뷰: AWS SA·UX·프론트엔드 리드·강사)

## Context

Security Group을 **캔버스 노드**로 놓고 **SG → 리소스 엣지**를 그려 "부착"하는
모델(ADR 0017·0042)에 대해 차니가 위화감을 제기했다 — "트랜잭션처럼 배선연결이
맞을까?" 4인 리뷰 전원이 **엣지는 틀린 기호**라고 판정했다:

- **엣지 = 방향·흐름**의 기호인데, SG는 흐르는 것이 아니라 리소스(ENI)에
  **할당되는 방화벽 규칙 묶음**이다. 화살표는 "트래픽이 SG를 통과한다"는 오해를 심는다.
- SG는 본질적으로 **다대다**다(한 리소스에 여러 SG, 한 SG를 여러 리소스가 공유).
  방향 엣지는 1:1 연결처럼 읽혀 이 공유·재사용 개념을 오히려 반대로 가르친다.
- 엣지는 이미 **거의 빈 껍데기**였다: tiered SG-to-SG ingress는 SG 엣지가 아니라
  트래픽 토폴로지에서 파생(ADR 0055)되므로, SG 엣지가 실제 나르는 정보는 "SG가
  하나라도 붙었다 → 미연결 경고 해제"뿐이었다.

리뷰 전원의 지향점은 **D안(리소스 위 방패 칩 + 라이브러리)**, 함정은 **C안(멤버십
박스 — React Flow 단일 부모 제약과 다중 SG 소속이 충돌)**으로 일치했다. 엔지니어링
리드는 B/C/D의 마이그레이션 비용이 동일함을(불변 `#g=` 공유 URL에 SG 노드+엣지가
박제되어 영구 번역 필요) 지적했고, 차니는 완성형인 **D를 한 번에** 선택했다.

## Decision

**SG를 캔버스 노드/엣지에서 제거하고, 스토어 컬렉션 + 리소스 할당으로 재모델링한다(D).**

- **데이터 모델**: `SecurityGroupDef {id, name, allowHttp, allowHttps, allowSsh}`가
  스토어 `securityGroups[]`에 살고, 각 리소스는 `config.securityGroupIds: string[]`로
  자신이 입은 SG를 기록한다. SG는 팔레트에서 제외(`resourceList`)되지만 레지스트리엔
  남는다.
- **UI**: 팔레트 하단 **보안 그룹 라이브러리**(생성·이름·규칙 토글·삭제), 인스펙터의
  **칩 토글**로 선택 리소스에 할당(ENI 보유 리소스만 — `SG_ASSIGNABLE`), 노드 위
  **색상 방패 칩**으로 할당 가시화, 라이브러리 hover 시 **같은 SG 멤버 하이라이트**.
- **Terraform 무손실(어댑터)**: 생성기는 여전히 노드+엣지 언어를 쓰므로,
  export 경계에서만 `materializeSecurityGroups`가 컬렉션+할당을 합성 sg 노드 +
  `sg → 리소스` 엣지로 투영한다. 덕분에 `terraform.ts`와 그 27개 테스트가 **불변**이고,
  tiered ingress·`vpc_security_group_ids` 배선이 그대로 나온다(실제 `terraform validate`
  통과 확인).
- **영구 마이그레이션**: `sanitizeSnapshot`이 레거시 v1(sg 노드 + 부착 엣지)을 항상
  번역한다 — sg 노드 → 컬렉션 def, 부착 엣지 → `securityGroupIds` 할당, 둘 다 캔버스
  그래프에서 제거. 공유 URL·localStorage(persist merge)·갤러리 슬롯이 한 경로로 수렴.
  persist·zundo temporal partialize에 `securityGroups` 편입(생성·편집·할당이 한
  undo 스텝).
- **검증 이동**: "SG 미지정" 경고는 `config.securityGroupIds`로, "SSH 개방" 경고는
  SG def에서 도출해 **그 SG를 입은 각 리소스 노드**에 표시(노드 배지·미션 스코프 채점에
  자연 반영). 미션 3-tier/시큐리티 하드닝/컨테이너는 SG를 config에서 판정.

## Consequences

- **좋은 점**: 기호가 진실해졌다 — SG는 흐름이 아니라 리소스에 붙는 라벨이고, 같은
  칩이 여러 리소스에 얹혀 공유·재사용이 캔버스에서 그대로 보인다. 캔버스에 선이 하나도
  늘지 않아 클러터가 준다. Terraform export는 무손실(어댑터), 12개 기존 미션 무회귀.
- **나쁜 점 / 한계**: SG끼리의 상호 참조(app SG가 ALB SG를 소스로)는 여전히 트래픽
  토폴로지에서 파생될 뿐 UI로 직접 편집하지 않는다. SG를 여러 VPC 리소스에 걸쳐 할당하면
  materialize가 첫 멤버의 VPC를 택한다(교차-VPC는 향후 경고 후보).
- **회귀 함정 하나 (해결)**: `getGraphIssues`에 `securityGroups` 인자를 추가하며 기본값
  `= []`가 **호출마다 새 배열**을 만들어, 2-인자 호출(`PropertyForm`)이 공유 memo를
  매 렌더 무효화 → useSyncExternalStore 셀렉터가 매번 새 참조 반환 → **React #185 무한
  루프**를 유발했다(이 저장소의 알려진 함정, ADR 0015/0020 계보). `PropertyForm`이
  `s.securityGroups`를 넘기도록 고치고, memo 기본값을 **동결된 공유 `EMPTY_SGS`**로
  바꿔 재발을 차단했다. 브라우저 스모크로 할당·칩·에러 0 확인.
- **후속**: 강사용 커스텀 미션에서 SG 요구를 `requiredResources`가 아닌 규칙으로 표현,
  교차-VPC SG 경고, SG 상호참조의 명시적 편집.
