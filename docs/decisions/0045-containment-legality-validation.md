# 0045. Containment-legality 상시 검증 — 부모 없는 불법 배치 감지

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude
- Extends: [0017](0017-security-model-and-severity-validation.md), [0038](0038-containment-attach-actions.md), [0040](0040-containment-audit-normalize-feedback.md)

## Context

QA 리포트 [QA-001 (Major)](../qa/2026-07-09-qa-report.md)에서 발견: containment 합법성이 **생성 시점에만** 강제된다. `addNode`·`onDrop`은 규칙을 확인하지만, `detachNode`([useGraphStore.ts](../../src/store/useGraphStore.ts))는 합법성 가드가 없고, 공유 URL·갤러리 슬롯 로드·hand-edited JSON도 `parentId`를 벗긴 채 통과한다. `normalizeContainment`(ADR 0040)는 로드 시 parent 없는 노드를 **컨테이너 안에 있을 때만** 편입하므로, 컨테이너 밖 root로 떨어진 노드는 재편입되지 않는다.

결과적으로 `allowedParents`에 `'canvas'`가 없는 리소스(subnet/igw/nat/sg/alb/ec2/ecs/efs/eks/rds/elasticache)가 최상위에 방치되어도 [checks.ts](../../src/graph/checks.ts)가 이를 잡지 못했다. 3중 파급:

- **미션 판정** — VPC를 requiredResources에 넣지 않는 미션에서 ALB를 detach해 root로 떨어뜨려도 `graphIssues.errors` 0건 → ★2("설정 오류 없음") 오통과.
- **Terraform** — orphan EC2/ALB가 `aws_subnet.REPLACE_ME.id`·`aws_vpc.REPLACE_ME.id`를 참조 → `terraform validate` 실패 = apply-ready 계약(ADR 0016/0025/0044) 위반.
- **시뮬 인그레스** — VPC 없는 external ALB를 인그레스 게이트가 명시적으로 면제([simulate.ts](../../src/graph/simulate.ts) `if (!vpc) return null`) → IGW 없이도 도달 성공.

## Decision

`graphIssues`의 노드 순회 앞단에 **containment-legality 규칙 1개**를 추가한다. 시점(생성/detach/로드/편집)에 무관하게 그래프 스냅샷을 상시 검증한다.

```ts
const parentNode = node.parentId ? byId.get(node.parentId) : undefined
if (!parentNode && !canBeTopLevel(t)) {
  push(errors, node.id, `${getResource(t).label}은(는) ${requiredParentLabel(t)} 안에 배치되어야 합니다 (현재 최상위에 방치됨).`)
}
```

- **판정 방식**: `canBeTopLevel(t)`(= `allowedParents.includes('canvas')`)가 `false`인데 **해석 가능한 parent가 없으면** error. `parentId`가 없는 경우와 `parentId`가 존재하지 않는 노드를 가리키는 dangling 경우(부분 로드·hand-edit) 둘 다 orphan으로 취급.
- **severity는 error** — containment 위반은 apply·시뮬 실패로 이어지므로 warning이 아니라 error(ADR 0017 등급 모델).
- **글로벌 서비스는 자동 면제** — S3/Cognito/Route53/CloudFront/DynamoDB/SQS/SNS/CloudWatch/Lambda/KMS/ACM/WAF/Secrets Manager/Kinesis는 `allowedParents`에 `canvas`를 가지므로 규칙을 그대로 통과. 26종 전수 확인(F1.5 ADR 0040 감사와 일관).
- **Terraform export 게이트** — [Toolbar.tsx](../../src/components/Toolbar.tsx)의 "Terraform 내보내기"는 export 전 `getGraphIssues().errors`를 집계해 error가 있으면 다운로드를 차단하고 노티스를 띄운다. REPLACE_ME 산출물이 조용히 나가는 것을 막아 apply-ready 계약을 복원.

## Consequences

- **미션 clear 자동 게이팅** — `allValid`([MissionPanel.tsx](../../src/components/MissionPanel.tsx))가 이미 `errors.get(n.id)`를 반영하므로 규칙 추가만으로 orphan 설계는 ★2 이상 불가. 미션 체커 로직은 미변경.
- **시뮬과 자연 정합** — sim의 loose-ALB 면제는 회귀 방지를 위해 그대로 두되(ADR 0039), 이제 그런 구성은 독립적으로 graph error로 잡혀 미션·export가 막힌다. sim 코드 무변경.
- **auto-normalize(ADR 0040)와 협력** — normalize가 편입할 수 있는 케이스(컨테이너 안)는 조용히 복구되고, 편입 못 하는 케이스(컨테이너 밖 root)는 error로 노출된다. 두 메커니즘이 상호 보완.
- **회귀 없음** — 시드 그래프(VPC▸Subnet▸EC2), best-practice 토폴로지, 12개 미션 fixture는 required-parent 리소스를 모두 컨테이너 안에 두므로 error 0건 유지.
- 규모가 작아 규칙 1개 + 테스트 13개 + export 게이트로 마무리.
