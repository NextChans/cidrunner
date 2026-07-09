# 0039. IGW 인터넷 인그레스 시뮬레이션 — external entry 도달성 검사

- Status: Accepted
- Date: 2026-07-09
- Deciders: 차니, Claude

## Context

차니 리포트 3번: **Internet Gateway가 캔버스에서 고립된 섬**이었다. IGW를 그려도
게임 내 기능이 없었고 — Terraform 생성에서는 public route table을 자동으로 파생하지만
([terraform.ts](../../src/graph/terraform.ts)), **시뮬레이션은 인터넷 인그레스를 전혀
모델링하지 않았다**. 그 결과 **인터넷 페이싱 ALB를 IGW 없이 그려도 sim이 성공**했다.
현실에서는 IGW 없는 VPC의 external ALB로는 인터넷 트래픽이 들어올 수 없다. IGW의
학습 가치가 결여되어 있었다.

체크([checks.ts](../../src/graph/checks.ts))는 이미 "인터넷 연결 ALB인데 IGW 없음"을
**경고**로만 띄웠다 — sim 성공/실패에는 영향이 없었다.

## Decision

**인터넷 인그레스 도달성 검사를 sim-blocking으로 승격**한다.
[simulate.ts](../../src/graph/simulate.ts)의 `traceFlow`가 노드를 방문할 때
`internetIngressBlock`으로 게이트한다.

- **대상** — `internal !== true`인 ALB(인터넷 페이싱)이고, **enclosing VPC가 있는**
  경우에만 검사한다.
- **조건** — 그 VPC에 (a) IGW가 attach돼 있고(`type === 'igw'` && 같은 VPC),
  (b) public subnet이 하나 이상 있어야 한다. 이는 `인터넷 → IGW → public subnet → ALB`
  경로를 모델링한다.
- **미충족 시** — 해당 ALB에서 flow를 차단하고 명확한 메시지를 낸다
  ("인터넷 페이싱 ALB인데 VPC에 Internet Gateway가 없습니다..." / "...퍼블릭 Subnet이
  없습니다."). CloudFront/Route 53가 앞단이어도 트래픽은 결국 그 ALB에서 막힌다.
- **면제** — `internal: true` ALB(내부 전용, IGW 불요)와, **VPC가 없는 느슨한 ALB**
  (추상 토폴로지 — 평가할 VPC 위상이 없음)는 검사하지 않는다. 후자는 기존 sim 성공
  케이스(단순 `ALB → EC2 → RDS` 테스트 등)의 **회귀를 막기 위한** 의도적 관용이다.

### Option C(플레이어-드로잉 라우팅 엣지) 기각

IGW ↔ subnet 라우팅을 **플레이어가 직접 엣지로 그리게** 하는 방안(Option C)은 기각했다.

- **진실 이중화** — route table·IGW attach는 이미 Terraform에서 위상으로부터 **자동
  파생**된다(ADR 0016 계열). 플레이어가 그린 라우팅 엣지와 파생 로직이 두 개의 진실
  소스가 되어 어긋날 수 있다.
- **cidrunner 철학 충돌** — "plumbing(route table, attach, subnet group)은 위상에서
  **파생**한다"가 핵심 설계다. 라우팅을 손으로 배선시키는 건 이 철학과 정면 충돌한다.

대신 IGW의 **존재와 attach**만으로 인그레스 성립 여부를 판정한다.

## Consequences

- **좋은 점**: IGW가 게임 내 역할을 갖는다 — 없으면 external ALB의 sim이 실패한다.
  IGW의 학습 가치가 확립됐다. 메시지가 "무엇을 추가해야 하는지"를 정확히 안내한다.
- **나쁜 점 / 한계**: VPC 밖 ALB는 여전히 관용된다(추상 토폴로지 지원 vs 엄격성의
  트레이드오프). public subnet **도달성**은 "VPC에 public subnet 존재"까지만 검사하고
  라우팅 경로 자체를 추적하진 않는다(파생 철학과 일관).
- **후속 영향**: **Sprint F2**에서 `인터넷 → IGW → public subnet → ALB` 인그레스 leg를
  **시각 파생 점선**으로 그려 마무리한다. ALB fallback(public subnet 없을 때) 정리도 F2.
