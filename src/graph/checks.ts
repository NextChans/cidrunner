import type { Edge } from '@xyflow/react'
import type { ResourceNodeType } from '@/store/useGraphStore'
import { cidrIssues, parseCidr } from '@/graph/cidr'

/**
 * Graph-level validation with severity (ADR 0017):
 *
 * - **errors** (red) — configurations AWS/Terraform would reject: CIDR
 *   containment/overlap, NAT outside a public subnet, ALB/RDS without the
 *   multi-AZ subnets they require.
 * - **warnings** (amber) — configurations that apply but violate security /
 *   best practices: SSH open to the world, DB in a public subnet, disabled
 *   encryption or public-access block, missing SG attachments.
 */
export interface GraphIssues {
  errors: Map<string, string[]>
  warnings: Map<string, string[]>
}

function push(map: Map<string, string[]>, id: string, msg: string) {
  const list = map.get(id) ?? []
  if (!list.includes(msg)) map.set(id, [...list, msg])
}

export function graphIssues(nodes: ResourceNodeType[], edges: Edge[]): GraphIssues {
  const errors = new Map<string, string[]>()
  const warnings = new Map<string, string[]>()
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // CIDR containment + sibling overlap (ADR 0015) are errors.
  for (const [id, msgs] of cidrIssues(nodes)) {
    for (const m of msgs) push(errors, id, m)
  }

  const vpcOf = (n: ResourceNodeType): ResourceNodeType | undefined => {
    let cur = n.parentId ? byId.get(n.parentId) : undefined
    while (cur) {
      if (cur.data.type === 'vpc') return cur
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return undefined
  }
  const subnetsIn = (vpcId: string) =>
    nodes.filter((n) => n.data.type === 'subnet' && vpcOf(n)?.id === vpcId)
  const distinctAzs = (subnets: ResourceNodeType[]) =>
    new Set(subnets.map((s) => String(s.data.config.az ?? 'a'))).size
  const attachedSGs = (nodeId: string) =>
    edges.filter(
      (e) => e.target === nodeId && byId.get(e.source)?.data.type === 'sg',
    )

  for (const node of nodes) {
    const t = node.data.type
    const cfg = node.data.config

    if (t === 'nat') {
      const parent = node.parentId ? byId.get(node.parentId) : undefined
      if (parent?.data.type === 'subnet' && parent.data.config.public !== true) {
        push(errors, node.id, 'NAT Gateway는 퍼블릭 Subnet 안에 있어야 합니다.')
      }
    }

    if (t === 'alb') {
      const vpc = vpcOf(node)
      if (vpc) {
        const pool = cfg.internal
          ? subnetsIn(vpc.id)
          : subnetsIn(vpc.id).filter((s) => s.data.config.public === true)
        if (pool.length < 2 || distinctAzs(pool) < 2) {
          push(
            errors,
            node.id,
            cfg.internal
              ? 'ALB는 서로 다른 AZ의 Subnet이 2개 이상 필요합니다.'
              : '인터넷 연결 ALB는 서로 다른 AZ의 퍼블릭 Subnet이 2개 이상 필요합니다.',
          )
        }
        if (
          !cfg.internal &&
          !nodes.some((n) => n.data.type === 'igw' && vpcOf(n)?.id === vpc.id)
        ) {
          push(warnings, node.id, '인터넷 연결 ALB인데 VPC에 Internet Gateway가 없습니다.')
        }
      }
      if (attachedSGs(node.id).length === 0) {
        push(warnings, node.id, '연결된 Security Group이 없습니다 (SG에서 엣지로 연결).')
      }
    }

    if (t === 'rds') {
      const vpc = vpcOf(node)
      if (vpc) {
        const subnets = subnetsIn(vpc.id)
        if (subnets.length < 2 || distinctAzs(subnets) < 2) {
          push(
            errors,
            node.id,
            'RDS는 서로 다른 AZ의 Subnet 2개 이상이 필요합니다 (DB Subnet Group).',
          )
        }
      }
      const parent = node.parentId ? byId.get(node.parentId) : undefined
      if (parent?.data.type === 'subnet' && parent.data.config.public === true) {
        push(warnings, node.id, '데이터베이스가 퍼블릭 Subnet에 있습니다 — 프라이빗 Subnet 권장.')
      }
      if (cfg.storage_encrypted === false) {
        push(warnings, node.id, '스토리지 암호화가 꺼져 있습니다.')
      }
      if (attachedSGs(node.id).length === 0) {
        push(warnings, node.id, '연결된 Security Group이 없습니다 (SG에서 엣지로 연결).')
      }
    }

    if (t === 'ec2' && attachedSGs(node.id).length === 0) {
      push(warnings, node.id, '연결된 Security Group이 없습니다 (SG에서 엣지로 연결).')
    }

    if (t === 'sg' && cfg.allow_ssh === true) {
      push(warnings, node.id, 'SSH(22)가 인터넷(0.0.0.0/0)에 개방되어 있습니다.')
    }

    if (t === 's3') {
      if (cfg.encryption === false) push(warnings, node.id, '기본 암호화가 꺼져 있습니다.')
      if (cfg.block_public_access === false) {
        push(warnings, node.id, '퍼블릭 액세스 차단이 꺼져 있습니다.')
      }
    }

    if (t === 'cloudfront') {
      const origin = edges.find(
        (e) =>
          e.source === node.id &&
          ['alb', 's3', 'lambda'].includes(byId.get(e.target)?.data.type ?? ''),
      )
      if (!origin) {
        push(errors, node.id, 'CloudFront에 오리진(ALB/S3/Lambda)이 연결되어 있지 않습니다.')
      } else if (byId.get(origin.target)?.data.config.internal === true) {
        push(warnings, node.id, '내부(Internal) ALB는 CloudFront 오리진으로 동작하지 않습니다.')
      }
    }

    if (t === 'route53') {
      const hasTarget = edges.some(
        (e) =>
          e.source === node.id &&
          ['cloudfront', 'alb'].includes(byId.get(e.target)?.data.type ?? ''),
      )
      if (!hasTarget) {
        push(warnings, node.id, '레코드가 가리킬 대상(CloudFront/ALB)이 없습니다.')
      }
    }

    if (t === 'sqs') {
      const hasConsumer = edges.some(
        (e) => e.source === node.id && byId.get(e.target)?.data.type === 'lambda',
      )
      if (!hasConsumer) {
        push(warnings, node.id, '큐를 소비할 Lambda가 연결되어 있지 않습니다.')
      }
    }

    // ElastiCache needs a subnet group across ≥2 AZs, like RDS (ADR 0026).
    if (t === 'elasticache') {
      const vpc = vpcOf(node)
      if (vpc) {
        const subnets = subnetsIn(vpc.id)
        if (subnets.length < 2 || distinctAzs(subnets) < 2) {
          push(
            errors,
            node.id,
            'ElastiCache는 서로 다른 AZ의 Subnet 2개 이상이 필요합니다 (Cache Subnet Group).',
          )
        }
      }
      const parent = node.parentId ? byId.get(node.parentId) : undefined
      if (parent?.data.type === 'subnet' && parent.data.config.public === true) {
        push(warnings, node.id, '캐시가 퍼블릭 Subnet에 있습니다 — 프라이빗 Subnet 권장.')
      }
      if (attachedSGs(node.id).length === 0) {
        push(warnings, node.id, '연결된 Security Group이 없습니다 (SG에서 엣지로 연결).')
      }
    }

    // EFS mount targets need an SG; encryption-at-rest is best practice.
    if (t === 'efs') {
      if (cfg.encrypted === false) push(warnings, node.id, '저장 데이터 암호화가 꺼져 있습니다.')
      if (attachedSGs(node.id).length === 0) {
        push(warnings, node.id, '연결된 Security Group이 없습니다 (SG에서 엣지로 연결).')
      }
    }

    // A Fargate service needs an SG for its ENIs.
    if (t === 'ecs' && attachedSGs(node.id).length === 0) {
      push(warnings, node.id, '연결된 Security Group이 없습니다 (SG에서 엣지로 연결).')
    }

    // EKS control plane + node group span ≥2 AZ subnets.
    if (t === 'eks') {
      const vpc = vpcOf(node)
      if (vpc) {
        const subnets = subnetsIn(vpc.id)
        if (subnets.length < 2 || distinctAzs(subnets) < 2) {
          push(errors, node.id, 'EKS는 서로 다른 AZ의 Subnet 2개 이상이 필요합니다.')
        }
      }
    }

    if (t === 'sns') {
      const hasSubscriber = edges.some(
        (e) =>
          e.source === node.id && ['sqs', 'lambda'].includes(byId.get(e.target)?.data.type ?? ''),
      )
      if (!hasSubscriber) {
        push(warnings, node.id, '토픽을 구독할 대상(SQS/Lambda)이 연결되어 있지 않습니다.')
      }
    }

    if (t === 'cloudwatch') {
      const hasTarget = edges.some((e) => e.source === node.id)
      if (!hasTarget) {
        push(warnings, node.id, '모니터링할 대상이 연결되어 있지 않습니다 (엣지로 연결).')
      }
    }

    // A Kinesis stream needs a Lambda consumer to do anything with the data.
    if (t === 'kinesis') {
      const hasConsumer = edges.some(
        (e) => e.source === node.id && byId.get(e.target)?.data.type === 'lambda',
      )
      if (!hasConsumer) {
        push(warnings, node.id, '스트림을 소비할 Lambda가 연결되어 있지 않습니다.')
      }
    }
  }

  // VPC-to-VPC CIDR overlap: AWS allows it, so it is not an error (ADR 0015),
  // but it breaks the moment the VPCs are peered/VPN-connected — warn.
  const vpcRanges = nodes
    .filter((n) => n.data.type === 'vpc')
    .map((n) => ({ node: n, range: parseCidr(n.data.config.cidr_block) }))
  for (let i = 0; i < vpcRanges.length; i++) {
    for (let j = i + 1; j < vpcRanges.length; j++) {
      const a = vpcRanges[i]
      const b = vpcRanges[j]
      if (!a || !b || !a.range || !b.range) continue
      if (a.range.start <= b.range.end && b.range.start <= a.range.end) {
        const msg = (other: ResourceNodeType) =>
          `다른 VPC(${other.data.label}, ${other.data.config.cidr_block})와 CIDR이 겹칩니다 — 피어링/VPN 연결 시 라우팅이 불가합니다.`
        push(warnings, a.node.id, msg(b.node))
        push(warnings, b.node.id, msg(a.node))
      }
    }
  }

  // Replication links (rds → rds, ADR 0019): the replica must match the
  // source engine, and cross-AZ placement is the point of a replica.
  for (const e of edges) {
    const src = byId.get(e.source)
    const dst = byId.get(e.target)
    if (src?.data.type !== 'rds' || dst?.data.type !== 'rds') continue
    if ((src.data.config.engine ?? 'mysql') !== (dst.data.config.engine ?? 'mysql')) {
      push(errors, dst.id, '읽기 복제본은 소스와 같은 엔진이어야 합니다.')
    }
    const azOf = (n: ResourceNodeType) => {
      const parent = n.parentId ? byId.get(n.parentId) : undefined
      return parent?.data.type === 'subnet' ? String(parent.data.config.az ?? 'a') : null
    }
    const srcAz = azOf(src)
    const dstAz = azOf(dst)
    if (srcAz !== null && srcAz === dstAz) {
      push(warnings, dst.id, '복제본이 소스와 같은 AZ에 있습니다 — 다른 AZ 권장.')
    }
  }

  return { errors, warnings }
}

// Single-entry memo: every consumer reads the same store snapshot, so caching
// the last (nodes, edges) pair is enough to share one computation per render.
let lastNodes: ResourceNodeType[] | null = null
let lastEdges: Edge[] | null = null
let lastResult: GraphIssues | null = null

/** Memoized {@link graphIssues} keyed on the store's array identities. */
export function getGraphIssues(nodes: ResourceNodeType[], edges: Edge[]): GraphIssues {
  if (nodes !== lastNodes || edges !== lastEdges || !lastResult) {
    lastNodes = nodes
    lastEdges = edges
    lastResult = graphIssues(nodes, edges)
  }
  return lastResult
}
