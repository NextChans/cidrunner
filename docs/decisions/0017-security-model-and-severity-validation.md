# 0017. Security model: SG attachment edges & severity-based validation

- Status: Accepted
- Date: 2026-07-08
- Deciders: 차니, Claude

## Context

"AWS 엔지니어 시뮬레이션"이 되려면 보안이 게임 요소여야 한다. 기존 검증은
오류 하나의 축(빨강)뿐이었고, Security Group은 캔버스에 떠 있기만 할 뿐 어느
리소스를 보호하는지 표현하지 못했다.

## Decision

1. **SG 연결 = 엣지.** SG에서 ALB/EC2/RDS로 그리는 엣지는 *어태치먼트*다 —
   트래픽이 아니므로 시뮬레이션에서 제외되고(점선 장미색 렌더링), Terraform에서
   `security_groups`/`vpc_security_group_ids`로 반영된다.
2. **검증 2단계 심각도** ([`src/graph/checks.ts`](../../src/graph/checks.ts)):
   - **오류(빨강)** — AWS/Terraform이 거부하는 구성: CIDR 포함/중첩(ADR 0015),
     NAT가 퍼블릭 Subnet 밖, ALB·RDS의 멀티 AZ Subnet 요건 미충족.
   - **경고(주황)** — apply는 되지만 보안/베스트 프랙티스 위반: SSH 0.0.0.0/0
     개방, DB가 퍼블릭 Subnet, 스토리지/S3 암호화 꺼짐, S3 퍼블릭 액세스 차단
     꺼짐, SG 미연결, 인터넷 ALB인데 IGW 없음.
3. **시각화** — 노드 테두리(빨강/주황), Inspector 배지(오류/경고)와 메시지 목록
   (⚠/🛡), 미션 컨텍스트의 `securityOk`(경고 0 여부).
4. **보안 기본값** — RDS `storage_encrypted`, S3 `encryption`·
   `block_public_access`는 기본 ON. 끄는 순간 경고가 뜬다.

## Consequences

- **좋은 점**: 보안이 배치·설정과 같은 문법(엣지·토글)으로 표현되고, 경고는
  게임의 피드백 루프(시큐리티 하드닝 미션의 별점)와 직결된다.
- **나쁜 점 / 한계**: SG 규칙은 여전히 토글 3종(ADR 0011)이라 계층 간 최소 권한
  (ALB SG→EC2 SG 참조)은 표현하지 못한다. IAM은 Lambda 실행 롤 외엔 없다.
- **후속 영향**: 관계형 규칙이 늘면 checks.ts에 추가한다. ADR 0015의 CIDR 검사는
  이 모듈의 오류 축으로 흡수됐다(모듈은 유지).
