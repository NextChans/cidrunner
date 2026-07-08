# 0005. Terraform generation approach

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

설계를 Terraform으로 내보내는 방법으로 세 가지를 검토했다: (1) HCL 문자열
템플릿 직접 조립, (2) `hcl`/`hcl-writer` 류의 라이브러리로 AST 생성,
(3) CDKTF(cdktf)로 프로그래밍 방식 합성. 이 앱은 서버가 없어 브라우저에서
실행되어야 하고([ADR 0004](0004-tech-stack.md)), 목표는 `terraform validate`
통과이지 `terraform apply` 성공이 아니다.

## Decision

각 리소스가 자신의 HCL을 문자열로 뱉는 **템플릿 함수**를 갖는다:

```ts
terraform: (id: string, config: Record<string, unknown>) => string
```

상위 export 로직이 노드별 결과를 조합해 `main.tf` + `variables.tf`를 만들고
JSZip으로 zip을 내려준다. 리소스 간 의존관계(예: Subnet의 `vpc_id`)는 그래프
topology(부모/엣지)에서 자동으로 참조 문자열을 생성한다. 목표는
`terraform validate` 통과이며 `apply`는 목표가 아니다.

## Consequences

- **좋은 점**: 브라우저에서 그대로 실행 가능하고 외부 종속성이 최소다. 리소스
  레지스트리와 자연스럽게 맞물려(각 `ResourceMeta.terraform`) 데이터 기반으로
  확장된다. 의존관계가 그래프에서 자동 해석된다.
- **나쁜 점**: 문자열 템플릿은 타입 안전성이 약하고, IAM 정책 문서처럼 복잡한
  중첩 구조는 별도 대응이 필요하다. `apply` 무결성(실제 프로비저닝)은 보장하지
  않는다.
- **후속 영향**: Phase 4에서 최소 세트(VPC/Subnet/SG/ALB/EC2/RDS)의
  `terraform()` 스텁을 실제 구현으로 채운다.
