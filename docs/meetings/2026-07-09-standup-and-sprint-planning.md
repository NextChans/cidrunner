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
- Trunk-based 유지, PR 없이 main 직접 push

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
