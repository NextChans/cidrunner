# 2026-07-09 스탠드업 & 스프린트 플래닝

- **참석**: 차니, Claude
- **어제(7/8) 리뷰**: Phase 0~5 완주 + v2 엔지니어 시뮬레이션 + Save/Share/CIDR/리소스1차/Editor Fundamentals. 78 files, +5624/-260, ADR 0010~0023 (14건).
- **오늘 진행 방침**: A/B/C/D 4개 스프린트 순차 진행 (A → B·C 병렬 → D).

## Sprint A — 부채 정리 & QA (오늘 오전)
- TS strict 전면 적용 (`tsconfig.app.json` 검증·필요 시 강화)
- apply-ready TF placeholder 감사: 시크릿·AMI·IAM 리소스에 대해 실 배포 blocker 잔재 여부 확인
- 테스트 coverage: `src/graph/__tests__/`에 부족한 영역 보강 (특히 CIDR 그래프 검증, 시뮬 엣지 케이스)
- 어제 마지막 SHA에서 실사용 스모크 세션 → 발견 이슈 리스트업 후 same-sprint에서 즉시 픽스
- 성공 기준: `tsc --noEmit --strict` clean, Vitest 통과 유지, apply-ready TF 감사 리포트 문서화

## Sprint B — 콘텐츠 확장 2차 (오후)
- 리소스 5~7개 추가: EKS, ECS, SNS, EFS, CloudWatch (팀 판단으로 조정 가능)
- 미션 3~4개 추가: 재난복구·글로벌 CDN·데이터 레이크·이벤트 드리븐 중 3~4개
- 각 리소스별 terraform template + validate 룰 + Palette·Inspector 매핑
- ADR 신규 (0024~) 로 결정 근거

## Sprint C — UX 심화 (오후, B와 병렬 가능)
- 키보드 단축키 (Ctrl+Z/Y, Del, R for reset, S for start 등)
- Node 우클릭 컨텍스트 메뉴 (delete, duplicate, edit)
- 성능 점검 (100+ 노드에서 lag 여부, React Flow 옵션 튜닝)
- 인터랙티브 튜토리얼 미션 (단계별 힌트 강화)

## Sprint D — 소셜·공유 강화 (저녁)
- OG 이미지 자동 생성 (URL 공유 시 스크린샷 미리보기)
- Achievements/badge 시스템 (별점 총합, 완주 미션 카운트)
- 갤러리 (공유 URL 저장 + 인기순 — 서버 없이 localStorage or IPFS-lite)
- 다국어 롤백 옵션 검토 (영문 재도입 vs 유지)

## 규칙
- 각 스프린트 완료 시 관련 ADR 신규 작성
- PHASES.md에 각 스프린트 History 항목 추가
- 코드 변경 시 관련 docs 같이 update (CONTRIBUTING.md 준수)
- ~~Trunk-based 유지, PR 없이 main 직접 push~~ → **Sprint B부터 feature branch → PR →
  merge 워크플로로 전환** (main 직접 push 금지). Sprint A까지는 trunk-based(main 직접
  push)였고, Sprint B에서 리뷰 게이트·CI green 확인을 위해 PR 기반으로 바꿨다. Sprint C도
  동일 워크플로를 따른다.

---

## Sprint A 결과 (완료: 2026-07-09 오전)

Sprint A 완료. `tsc -b` clean · Vitest 59/59 통과 · `vite build` 성공.

- **TS strict 강화** — `strict`는 이미 켜져 있었고, 누락돼 있던 `noImplicitReturns`(무비용)와
  `noUncheckedIndexedAccess`(48건 노출)를 app/node tsconfig에 추가. 인덱스/정규식 매치 접근을
  `reduce` 폴딩·명시적 undefined 가드로 실수정 (`!` 남발 없이 소스 8곳 + 테스트 어서션). ADR 0024.
- **apply-ready TF 감사** — 실 배포 blocker는 **0건**. 시크릿(`var.db_password` sensitive·no-default),
  AMI(`data.aws_ami` 조회), IAM(Lambda 실행 역할 실체화), region(변수화) 모두 해소돼 있음을 확인.
  잔존 `REPLACE_ME` 6곳은 에디터 nesting 룰이 막는 고아 리소스용 **의도된 loud 마커**로 유지 판단. ADR 0025.
- **테스트 보강** — 8→11 파일, 42→59 케이스(+17). CIDR 엣지(/0·/32·호스트비트·경계),
  시뮬 순환/분기 안전성, TF apply 불변식(ADR 0025 락인) 추가.
- **문서-코드 mismatch 5건 수정** — PHASES Phase 4의 "placeholder secrets/AMI/IAM·apply 비목표"(→ADR 0016
  superseded 주석), ARCHITECTURE의 stale `terraform: (id, config)` 시그니처+"stubbed",
  README/README.ko 프로젝트 구조의 "10종·stub"(→14종·apply-ready)·미션 목록(3→6).
- **라이브 사이트** https://nextchans.github.io/cidrunner/ HTTP 200 확인.

남은 관심사: (1) node_modules가 stale하면 `npm ci` 필요(감사 초기 발견). (2) B/C/D는 후속 태스크.

---

## Sprint B 결과 (완료: 2026-07-09 오후)

Sprint B 완료. `tsc -b` clean · Vitest 74/74 통과 · `oxlint` clean · `vite build` 성공 ·
로컬 dev 팔레트·미션 렌더 확인. **feature branch → PR → merge** 워크플로로 진행(main 직접
push 금지 규칙 적용).

- **리소스 14→20종** — ECS Fargate·EKS(컴퓨팅), ElastiCache(데이터베이스), EFS(스토리지),
  SNS(앱 통합), CloudWatch(**새 `관리·모니터링` 카테고리**). 모두 apply-ready HCL:
  ECS는 자기완결형 Fargate 서비스, EKS는 롤+정책+노드그룹, ElastiCache는 VPC별 캐시
  Subnet Group, EFS는 AZ당 마운트 타깃, SNS는 구독+전달 권한, CloudWatch는 로그 그룹+
  대상별 지표 알람. ALB→컨테이너는 시뮬/토폴로지 관계로만(타깃 그룹 `target_type` 충돌
  회피). 싱크에 ElastiCache·EFS 추가, 컨테이너는 진입 가능 컴퓨트. ADR 0026.
- **미션 6→10종** — 컨테이너 워크로드(ALB→ECS/EKS→RDS), 글로벌 동적 웹(R53→CF→ALB→EC2→RDS),
  이벤트 드리븐 팬아웃(Lambda→SNS→SQS→Lambda→DynamoDB), 재난 복구(Multi-AZ + 크로스 AZ
  읽기 복제본). ElastiCache/EFS/CloudWatch는 자유 모드 콘텐츠로. ADR 0027.
- **테스트 +15** — 신규 리소스 엣지 규칙·시뮬(싱크·컨테이너·팬아웃)·검증(멀티 AZ 오류·
  dangling 경고)·terraform 스냅샷(ECS/EKS/ElastiCache/EFS/SNS/CloudWatch apply-ready 불변식)·
  미션 4종 3-star 클리어 + 미달 케이스.
- **Kinesis 보류** — 스트림 단독은 도달할 싱크가 없어 시뮬이 막힘. 데이터 레이크 미션·
  스트림 소비 모델과 함께 3차 배치로.
- **라이브 사이트** https://nextchans.github.io/cidrunner/ (merge 후 배포 반영 확인).

---

## Sprint C 결과 (완료: 2026-07-09 저녁)

Sprint C 완료. `tsc -b` clean · Vitest 80/80 통과 · `oxlint` clean · `vite build` 성공
(**500 kB 경고 해소**) · 로컬 dev 단축키·우클릭·성능 확인. feature branch → PR → merge
워크플로로 진행.

- **키보드 단축키** — `useKeyboardShortcuts` 훅(ReactFlowProvider 내부 마운트)으로 통합:
  Undo(⌘Z)·Redo(⌘⇧Z/⌘Y)·복제(⌘D)·삭제(Del/Backspace)·선택 해제/닫기(Esc)·화면 맞춤(R)·
  시뮬 시작·중지(S)·Terraform 내보내기(E)·도움말(?). 입력창 포커스 시 비활성(Esc 예외).
  툴바에 단축키 버튼 + `ShortcutHelp` 모달. ADR 0028.
- **노드 우클릭 컨텍스트 메뉴** — `NodeContextMenu`(속성 편집·복제·엣지 지우기·부모에서
  분리·삭제). 스토어에 `contextMenu` 상태. 클릭 지점 앵커 + 뷰포트 클램프, 바깥 클릭·Esc로
  닫힘. ADR 0028.
- **성능·번들** — React Flow `onlyRenderVisibleElements`로 대형 그래프 컬링. Vite(rolldown)
  `codeSplitting.groups`로 react-flow·vendor 청크 분리, JSZip은 export 시점 lazy import,
  Onboarding·ShortcutHelp·NodeContextMenu는 `React.lazy`. **단일 574.76 kB → 최대 청크
  195.63 kB**, 500 kB 경고 소멸. ADR 0029.
- **인터랙티브 튜토리얼** — 미션에 backward-compatible `steps?: TutorialStep[]` 추가,
  튜토리얼 미션만 채움. 활성 시 실시간 체크리스트로 "다음 단계" 강조. 기존 clear 로직
  무변경. ADR 0030.
- **CI Node 20 deprecation 해소** — `actions/checkout` v4→v5, `actions/setup-node` v4→v5
  (node24 런타임 기반), CI Node 20→22.
- **문서 정합화** — 이 미팅 doc의 "trunk-based·PR 없이 push" 규칙을 Sprint B 전환 사실에
  맞춰 정정.

---

## Sprint D 결과 (완료: 2026-07-09 저녁 — 오늘의 마지막 스프린트)

Sprint D 완료. `tsc -b` clean · Vitest 92/92 통과 · `oxlint` clean · `vite build` 성공(최대
청크 197 kB, 500 kB 경고 없음) · 로컬 dev 배지·갤러리·OG 메타 확인. feature branch → PR →
merge 워크플로로 진행.

- **정적 OG 이미지** — `public/og-image.png`(1200×630, PIL로 결정적 생성: favicon과 동일한
  네트워크 모티프 + 타이틀 + 한글 태그라인). `index.html`에 Open Graph(type·title·description·
  url·image·width/height·alt·locale) + Twitter `summary_large_image` 메타 추가. 이미지·URL은
  GitHub Pages 절대 경로. 동적 OG는 서버가 필요해 보류(재검토 조건 명시). ADR 0031.
- **배지 5종** — `first-mission`·`first-three-star`·`first-slot`·`five-missions`·
  `all-three-star`. `bestStars` + 갤러리 슬롯 수에서 파생되는 **순수 predicate**라 미션 채점
  로직 무변경. 스토어는 "이미 알린 배지"(`earnedBadges`)만 persist하고, `useAchievements` 훅이
  마운트 시 기존 진행도를 조용히 백필한 뒤 세션 중 신규 획득만 토스트. 툴바 트로피 아이콘(획득 수
  chip) → lazy 모달. ADR 0032.
- **다중 슬롯 갤러리** — persist에 `slots` 추가(공유와 동일 스냅샷 형태 → 로드 시 동일 sanitizer
  재통과). 썸네일은 저장하지 않고 노드 위치에서 **순수 SVG 즉석 렌더**(`thumbnail.ts`, 부모
  체인 절대좌표 접기 + viewBox 정규화). 카드 클릭=불러오기, 이름변경·삭제. backward-compat로
  persist 버전 미변경(기존 저장 설계 보존). ADR 0033.
- **i18n 재검토** — Korean-first **유지**, 코드 변경 없음. 도입 트리거(별 100개·영어권 이슈
  유입·비한국어권 배포 목표) 명시. README/README.ko에 국제화 로드맵 단락 추가. ADR 0034.
- **번들** — Gallery(4.98 kB)·Achievements(1.93 kB) 모두 lazy 청크. 최대 청크 197 kB 유지.
- **테스트 80→92** — 배지 predicate 8케이스(신규/파생/전 미션 3-star 경계), 썸네일 투영·정렬·
  절대좌표 4케이스.

---

## Retrospective — 오늘 4개 스프린트 완료 (2026-07-09)

하루에 A(부채·QA) → B(콘텐츠 2차) → C(UX 심화) → D(소셜·공유) 4개 스프린트를 완주했다.

- **회귀 0**: 각 스프린트가 `tsc`/Vitest/`oxlint`/`build` 게이트를 통과하고 이전 스프린트 결과를
  깨지 않았다. 테스트는 42(어제)→59(A)→74(B)→80(C)→**92(D)** 로 꾸준히 증가.
- **워크플로**: Sprint A만 trunk-based, B부터 feature branch → PR → CI green → merge 정착.
  D까지 동일하게 유지 — 리뷰 게이트·CI 확인이 하루 4스프린트 속도에서도 안전망이 됐다.
- **ADR 규율**: 결정마다 ADR을 남겨 0024~0034(11건) 축적. "왜"가 문서로 남아 재논쟁 비용 0.
- **의도적 보류**: Kinesis·데이터 레이크(B), 이벤트형 배지 🚀(D), 동적 OG(D), i18n(D)을 조건과
  함께 명시 보류 — 스코프 팽창 없이 후속(Sprint E: 리소스 3차·검색)으로 넘겼다.
- **남은 관심사(Sprint E 시작 전)**: (1) OG 실 SNS 미리보기는 배포 후 각 플랫폼 크롤러로만
  검증 가능(로컬은 head 태그 확인까지). (2) 갤러리 슬롯은 localStorage 스코프라 기기 간 동기화
  없음 — 대량 슬롯 시 용량/정리 UX 필요. (3) 리소스 확장 3차·검색은 Sprint E로 이월.

---

## Sprint E 결과 (완료: 2026-07-09 — A–D 완주 후 후속)

Sprint E 완료. `tsc -b` clean · Vitest 109/109 통과 · `oxlint` clean · `vite build` 성공(최대
청크 198 kB, 500 kB 경고 없음) · 로컬 dev에서 새 리소스 6종·미션 2종·검색(필터/`/`/Escape/
결과 없음) 확인. feature branch → PR → merge 워크플로로 진행.

- **리소스 20→26종** — Cognito(앱 인증)·Secrets Manager(시크릿)·KMS(암호화 키)·ACM(TLS)·
  WAF(L7 방어)·Kinesis(실시간 스트림). `security` 카테고리를 **보안·아이덴티티**로 재정의해
  SG와 함께 5종을 모으고, Kinesis는 앱 통합 재사용. Kinesis는 entry-capable(파이프라인 머리),
  `secretsmanager → kms`로 고객 관리 키 배선. Cognito/ACM/WAF는 진입점 판정 회귀를 피해
  자기완결형 독립 노드로. Sprint B 보류(Kinesis)를 해소. ADR 0035.
- **미션 10→12종** — 데이터 파이프라인(Kinesis→Lambda→S3), 보안·인증 웹(CF→ALB→EC2→RDS +
  Cognito·Secrets·ACM·WAF 존재). "Lambda→Kinesis producer" 미션은 lambda 리소스 수정이 필요해
  후속으로(회귀 금지). ADR 0036.
- **Palette 검색** — Zustand `search`(transient) + `useResourceSearch`(100ms debounce,
  label/description/category/type 부분·대소문자 무시 매칭). `/` 전역 포커스(데스크톱 aside id
  단일), 입력창 Escape는 로컬 clear/blur(전역 선택해제로 안 샘). 매칭 0 카테고리 숨김·전체 0건
  메시지·`×` clear·`aria-live` 결과 카운트. ShortcutHelp에 `/` 추가. ADR 0037.
- **테스트 92→109** — 리소스/미션/터라폼 12케이스(엣지 규칙·Kinesis 진입·Secrets↔KMS·별점·
  brace 균형), 검색 필터 순수함수 5케이스.
- **다음 관심사**: (1) WAF→ALB·ACM→ALB·Cognito 인증 액션 결합은 진입점 "비-트래픽 엣지"
  일반화 리팩터 후 4차 배치. (2) Kinesis Firehose→S3(데이터 레이크)·Lambda producer 스트림.
  (3) 검색에 최근/자주 쓰는 정렬·동의어 사전 여지.

## Sprint F1 결과 (완료: 2026-07-09 — 도메인 모델 정확도 P0 3건)

차니 리포트 3건(P0) 반영. `tsc -b` strict clean · Vitest 120/120 통과 · `oxlint` clean ·
`vite build` 성공(최대 청크 199 kB, 500 kB 경고 없음) · 로컬 dev에서 우클릭 분리↔재부착
루프(부모에서 분리 → 부모에 넣기 flyout → Public Subnet 재부착) end-to-end 확인.
feature branch → PR → merge.

- **Drop-onto-parent (P0.1)** — 기존 노드를 컨테이너 위로 드래그하면 `onNodeDragStop`이
  노드 중앙 절대좌표로 가장 안쪽 컨테이너를 판정, 스토어 `attachToParent` 호출.
  `findDropParent`에 `excludeIds`(자기+자손)를 추가해 팔레트 드롭과 공용. `extent: 'parent'`
  잠금 특성상 이미 nested된 노드의 드래그 이동은 겹칠 때만 — 그 경우 우클릭으로. ADR 0038.
- **우클릭 "부모에 넣기 / 부모 변경" (P0.2)** — 규칙 허용 후보 컨테이너를 flyout 서브메뉴로.
  `attachToParent`가 절대→상대 좌표 변환·사이클 방지·위상 재정렬 담당. "부모에서 분리"와
  완전 대칭 — 한 번 분리해도 복구 가능(리포트 갭 해소). ADR 0038.
- **IGW 인터넷 인그레스 sim (P0.3)** — `traceFlow`가 인터넷 페이싱 ALB(`internal!==true`,
  enclosing VPC 있음) 방문 시 IGW attach + public subnet 존재를 검사, 미충족이면 그 ALB에서
  차단하고 명확한 메시지. internal ALB·VPC 없는 loose ALB는 면제(기존 성공 케이스 회귀 방지).
  Option C(플레이어-드로잉 라우팅 엣지)는 진실 이중화·"plumbing은 파생" 철학 충돌로 기각. ADR 0039.
- **테스트 109→120** — `simulate-ingress` 6케이스(IGW 없음/public subnet 없음/성공/internal 면제/
  loose 면제/CF-fed 차단), `containment` 5케이스(좌표 변환·렌더 순서·규칙 거부·no-op).
- **남은 관심사(Sprint F2)**: (1) `인터넷 → IGW → public subnet → ALB` 인그레스 leg를 시각
  파생 점선으로. (2) public subnet 없을 때 ALB fallback 정리. (3) drop 거부 hover 시각 피드백
  (빨간 테두리)은 미구현 여지.

## Sprint F1.5 결과 (완료: 2026-07-09 — 차니 후속 P0.4~0.6)

차니 추가 리포트("NAT Gateway도 부모와 분리됨") 후속. F1 완료 후 별도 브랜치로 진행.
`tsc -b` strict clean · Vitest **120→126** 통과 · `oxlint` clean · `vite build` 성공 ·
공유 URL(detached EC2 inside subnet) 로드 → auto-normalize end-to-end 확인(store parentId·
extent·상대좌표·렌더순서 + 시각 편입). feature branch → PR → merge.

- **P0.4 allowedParents 전수 감사(26종)** — AWS 배치 모델과 대조, **전부 정합(코드 변경 0)**.
  핵심 발견: **NAT "분리"는 `allowedParents` 버그가 아니다**(`['subnet']` 올바름) — 로드 시
  정규화 부재 + 재부착 수단 부재(F1 P0.2에서 해소)가 원인. 리포트 초안의 Cognito/Secrets/
  KMS/ACM/WAF/Kinesis "→VPC" 분류는 **부정확**(리전/글로벌 서비스라 VPC 밖, `canvas` 유지).
  전체 대조표는 ADR 0040에 첨부.
- **P0.5 auto-normalize** — `normalizeContainment`가 로드 경계(공유 URL·슬롯·localStorage
  리하이드레이트)에서 parent 미설정이지만 공간적으로 컨테이너 안인 노드를 가장 안쪽 허용
  컨테이너로 편입. **"없는 것만 채움"**(기존 parent 유지), 절대→상대 좌표 변환·`extent`·위상
  정렬, 한 패스로 중첩 깊이까지(자유 subnet→VPC, 그 안 ec2→subnet). 규칙 거부 시 미편입. ADR 0040.
- **P0.6 드래그 드롭-타깃 피드백** — transient `dropTarget: {id, valid}`(미persist·미undo).
  `onNodeDrag`가 `containerUnder`로 컨테이너+유효성 계산, `onNodeDragStop` 클리어, 동일값 dedup.
  유효=accent 링+틴트, 규칙 거부=rose 링+틴트. ADR 0040.
- **리팩터** — `absolutePosition`·`orderByParent`를 스토어에서 `graph/containment.ts`로 추출해
  스토어(`attachToParent`)·normalize·테스트가 공유(타입 전용 import로 순환 참조 없음).
- **테스트 120→126** — `normalize` 5(편입·중첩깊이·기존parent 유지·규칙거부·밖은 무시),
  `setDropTarget` 1(dedup·클리어).
- **범위 판단** — **P0.7(Lambda/API GW 분리)은 F2로 이월**. 신규 리소스+Terraform 6블록+미션
  fixture 마이그레이션+sim entry로 광범위·독립적이라 별도 PR이 리뷰·회귀 관리에 유리.
- **남은 관심사(F2)**: P0.7 + 드래그 중 자동 detach(현 `extent:'parent'` 잠금상 실효 낮음) +
  Lambda VPC 연결 모델(allowedParents vs 파생) 결정.

---

## Sprint F2 결과 (미션·SG 감사 + IGW 파생 점선 + ALB 정리)

차니 리포트 4건 후속. F1.5 완료 후 별도 브랜치 `sprint-f2/mission-sg-audit-igw-visual`.
`tsc -b` strict clean · Vitest **126→139** 통과 · `oxlint` clean · `vite build` 성공(최대
청크 199 kB) · 로컬 dev에서 IGW 점선·미션 ★3 end-to-end 확인. feature branch → PR → merge.

- **미션 체커 감사(P0)** — 12개 미션 **해피패스는 전부 정상**(전수 재현). 리포트의 "정적 웹·
  비동기가 ★3 안 뜸"의 근본원인은 체크 로직이 아니라 **평가 범위**였다: ★3 `securityOk`가
  **그래프 전체**를 보므로, 첫 로드 시드(VPC▸Subnet▸EC2, SG 없음)를 안 건드리는 VPC-밖 미션
  (정적 웹·비동기·서버리스·이벤트·데이터 파이프라인)이 시드 EC2의 "SG 없음" **경고**로 ★2에
  갇혔다. 힌트도 정적 문자열이라 무관한 블로커에도 계속 떴다. → `scopedSecurityOk(ctx, anchors)`
  (만족 flow에서 엣지 **양방향**+부모 체인 closure)로 8개 미션 전환. 무관 노드는 무시, SSH 개방
  SG·public S3 등 **빌드 내부 경고는 유지**. `allValid`(★2)는 전체 유지(에러는 시드에 오염 안 됨).
  그리디 tracer 막다른-엣지는 [simulate-edge.test.ts]가 **의도적으로 락인한** 동작이라 미변경. ADR 0041.
- **SG 부착 룰(P0)** — **ECS↔SG 모순** 확정: `canConnect('sg','ecs')=false`인데 checks.ts는 경고.
  `sg.connectsTo`에 `ecs·eks·elasticache·efs` 추가 + checks.ts에 EKS 경고 추가로 **"부착 가능
  집합 == 경고 집합"** 불변식 확립. Lambda는 VPC-밖 모델이라 제외. ADR 0042.
- **IGW 파생 점선(P1)** — 엔진 소유 파생 엣지 프레임워크(`derived.ts`): 저장·편집·선택·삭제 불가,
  렌더 전용 병합. IGW→같은 VPC 퍼블릭 subnet slate(#94a3b8) 점선 + hover 툴팁 "라우팅
  (0.0.0.0/0 → IGW)". 범용이라 RDS→subnet group 등 재사용 가능. ADR 0043.
- **ALB fallback 정리(P2)** — 외부 ALB의 퍼블릭 subnet 부재 시 프라이빗으로 조용히 fallback하던
  dead-path 제거(checks.ts가 이미 에러로 잡음), `REPLACE_ME` 명시(ECS/EKS와 일관). ADR 0044.
- **테스트 126→139** — `missions` 9(캐노니컬 ★3·시드 잔존 ★3·public S3 ★2 캡·SSH SG 3★ 미만·
  무관 리소스 무시·SG 부착 불변식), `derived` 4.
- **남은 관심사(F3)**: Lambda+API GW 분리(별도 PR 규모) + 그리디 tracer 백트래킹 재검토(현재
  의도 동작으로 락인) + Lambda VPC 연결 모델 결정.
