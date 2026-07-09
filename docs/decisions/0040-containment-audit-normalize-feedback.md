# 0040. Containment 정확도 — allowedParents 감사 · auto-normalize · 드래그 피드백

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0038](0038-containment-attach-actions.md)

## Context

[ADR 0038](0038-containment-attach-actions.md)에서 attach 액션을 대칭화한 뒤에도 차니
리포트가 남은 갭을 지적했다: **"NAT Gateway도 부모와 분리된다"**. 조사 결과 이는 두 층의
문제였다 — (1) `allowedParents` 모델이 실제 AWS와 어긋났는지에 대한 확신 부재, (2) 로드된
그래프(공유 URL·슬롯·localStorage)에서 노드가 **공간적으로는 컨테이너 안**에 있는데
`parentId`가 비어 "분리된" 것처럼 보이는 상태. 추가로 (3) 드래그 시 어디에 드롭되는지
시각 피드백이 없어 재부착 UX가 불투명했다.

## Decision

### 1) allowedParents 전수 감사 (26종) — 코드 변경 0

26종을 AWS 배치 모델과 대조한 결과 **전부 정확**했다. 리포트 초안의 일부 분류(아래 ⚠️)는
오히려 부정확했고, 현재 코드가 옳다.

| 리소스 | `allowedParents` | AWS 근거 | 판정 |
| --- | --- | --- | --- |
| vpc | `canvas` | 최상위 네트워크 경계 | ✓ |
| subnet | `vpc` | VPC의 CIDR 분할 | ✓ |
| igw | `vpc` | VPC에 attach되는 경계 GW | ✓ |
| nat | `subnet` | 퍼블릭 subnet 거주(퍼블릭 조건은 checks.ts 에러) | ✓ |
| sg | `vpc` | VPC 스코프 방화벽 | ✓ |
| alb | `vpc` | 여러 subnet에 걸침(subnet-spanning) | ✓ |
| ec2 | `subnet` | 단일 subnet의 ENI | ✓ |
| ecs | `vpc` | Fargate task ENI는 subnet, 서비스는 VPC 레벨 | ✓ |
| eks | `vpc` | 컨트롤플레인+노드그룹이 다중 AZ subnet에 걸침 | ✓ |
| rds | `subnet` | 노드는 한 subnet, subnet group은 파생 | ✓ |
| elasticache | `subnet` | RDS와 동일 모델 | ✓ |
| efs | `vpc` | 파일시스템은 리전, mount target은 AZ별 subnet 파생 | ✓ |
| s3 | `canvas` | 리전 오브젝트 스토어, VPC 밖 | ✓ |
| lambda | `canvas` | 기본 VPC 밖(VPC 연결은 파생·엣지) | ✓ |
| dynamodb | `canvas` | 리전 서비스 | ✓ |
| cloudfront | `canvas` | 글로벌 엣지 | ✓ |
| route53 | `canvas` | 글로벌 DNS | ✓ |
| sqs · sns · cloudwatch | `canvas` | 리전 관리형 서비스 | ✓ |
| cognito · secretsmanager · kms · acm · waf · kinesis | `canvas` | ⚠️ **계정/리전·글로벌 서비스 — VPC에 들어가지 않음** | ✓ |

> ⚠️ 리포트 초안은 Cognito/Secrets/KMS/ACM/WAF/Kinesis를 "→ VPC"로 분류했으나, 이들은
> VPC 리소스가 아니다(WAF는 ALB/CloudFront에 *연결*되지만 VPC *안*에 있지 않음). 현재
> `canvas`가 정답이라 변경하지 않는다.

**결론**: NAT "분리" 버그의 원인은 `allowedParents`(`['subnet']`, 올바름)가 아니라
로드 시 정규화 부재(아래 2)와 재부착 수단 부재([ADR 0038](0038-containment-attach-actions.md)에서 해소)였다.

### 2) Auto-normalize (`normalizeContainment`)

로드 경계에서 **parent 미설정이지만 공간적으로 컨테이너 안**에 있는 노드를 가장 안쪽의
허용 컨테이너로 자동 편입한다([containment.ts](../../src/graph/containment.ts)).

- **정책** — `parentId`가 **이미 있는 노드는 그대로 둔다**("없는 것만 채움"). 편입 시 절대
  좌표를 새 부모 프레임으로 변환하고 `extent: 'parent'`, 그리고 `orderByParent`로 위상
  정렬. 한 패스로 중첩 깊이까지 정규화(자유 subnet→VPC, 그 안 자유 ec2→subnet)된다 —
  절대 좌표 기준으로 판정하므로 재부모화 순서와 무관하게 합성 좌표가 보존된다.
- **실행 지점** — `loadDesign`(공유 URL·JSON 가져오기), `loadSlot`(갤러리), persist
  `merge`(localStorage 리하이드레이트). 시드 그래프는 이미 정합하므로 no-op.
- **판정 기준** — 노드의 원점(origin)을 절대 좌표로 접어 컨테이너의 절대 bbox(명시적
  `style` 크기 필요 — VPC/Subnet은 항상 보유) 안에 있는지 검사. 규칙(`canContain`)이
  금지하면 편입하지 않는다(예: subnet 안에 놓인 자유 S3는 그대로 둠).

### 3) 드래그 드롭-타깃 시각 피드백

드래그 중 노드 중앙 밑의 가장 안쪽 컨테이너를 실시간 하이라이트한다.

- **상태** — 스토어 `dropTarget: { id, valid } | null`(transient, 미persist·미undo).
  `onNodeDrag`가 `containerUnder`로 컨테이너와 유효성(`canContain`)을 계산해 세팅,
  `onNodeDragStop`에서 클리어. 동일 값 재세팅은 dedup(불필요 리렌더 방지).
- **규격** — 유효한 컨테이너: **accent(에메랄드) 링 + 배경 틴트**. 규칙이 거부하는
  컨테이너(예: EC2를 VPC 본체 위로): **rose(빨강) 링 + 틴트**. 컨테이너 밖: 하이라이트
  없음. 드래그 대상 자신과 자손은 후보에서 제외.

## Consequences

- **좋은 점**: 로드된 어떤 그래프든 "공간적 포함 = 논리적 부모" 불변식으로 수렴 —
  IGW/NAT가 VPC에서 "분리돼" 보이던 상태가 자동 교정된다. 드래그 시 드롭 위치가 색으로
  드러나 재부착이 예측 가능. allowedParents는 감사로 정합성 확인(수정 불필요).
- **나쁜 점 / 한계**: normalize는 **컨테이너에 명시적 `style` 크기가 있어야** 판정
  가능(현재 컨테이너는 항상 보유). 판정은 노드 **원점 기준**(부분 겹침은 무시). 의도적
  분리 후에도 노드가 컨테이너 bbox 안에 남아 있으면 다음 로드 시 재편입된다 — cidrunner의
  "공간=논리" 철학상 의도된 동작(진짜 분리하려면 컨테이너 밖으로 옮겨야 함).
- **후속 영향**: 드래그 중 자동 detach(밖으로 끌어냄)는 여전히 미도입 —
  [ADR 0038](0038-containment-attach-actions.md)의 `extent: 'parent'` 잠금 때문에 실효성이
  낮다. Lambda의 VPC 연결(`allowedParents`에 `vpc` 추가 vs 엣지 파생)은 별도 결정 여지.
