import type { Edge } from '@xyflow/react'
import { getResource, type ResourceType } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'
import { materializeSecurityGroups, type SecurityGroupDef } from '@/graph/securityGroups'

/**
 * Apply-ready Terraform generation (ADR 0016, refining ADR 0013). Each resource
 * owns its HCL emitter (`ResourceMeta.terraform`); this module resolves
 * cross-resource references from the graph topology (parents, SG-attachment
 * edges, ALB-target edges), derives the plumbing AWS needs but the canvas
 * doesn't show (route tables, DB subnet groups, the AMI lookup), assembles the
 * files, and zips them for download.
 */

/** Terraform-safe local resource name (label / reference), e.g. `subnet_1`. */
function tfName(id: string): string {
  const n = id.replace(/[^a-zA-Z0-9_]/g, '_')
  return /^[a-zA-Z_]/.test(n) ? n : `r_${n}`
}

/** Value safe for AWS `name` attributes (alphanumeric + hyphen). */
function awsName(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '-')
}

/** Emit order so the file reads network-outward. */
const ORDER: ResourceType[] = [
  // account/az are organizational containers — they emit no HCL (ADR 0050) but
  // are listed so the sort is total.
  'account', 'az',
  'vpc', 'subnet', 'igw', 'nat', 'sg', 'kms', 'acm', 'cognito', 'secretsmanager',
  'efs', 'ecr', 'alb', 'ec2', 'ecs', 'eks', 'rds', 'elasticache', 's3', 'dynamodb',
  'kinesis', 'sqs', 'sns', 'lambda', 'apigw', 'cloudwatch', 'cloudtrail', 'waf', 'cloudfront', 'route53',
]

function ancestorOfType(
  node: ResourceNodeType,
  type: ResourceType,
  byId: Map<string, ResourceNodeType>,
): ResourceNodeType | undefined {
  let cur = node.parentId ? byId.get(node.parentId) : undefined
  while (cur) {
    if (cur.data.type === type) return cur
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return undefined
}

/**
 * A single "not production-ready" gap the generator knows it does NOT emit —
 * either because it is out of the topology generator's scope (app runtime,
 * audit pipelines) or because the drawn graph left a security block unwired.
 */
interface ReadinessGap {
  /** Stable, machine-readable key (kebab-case). */
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

/**
 * Builds `PRODUCTION-READINESS.md` (ADR 0056). The Terraform export is
 * *apply-ready* — it plans and applies — but "applies" is not "production-ready".
 * Rather than let a plausible-looking stack imply completeness, we ship a
 * machine-readable manifest that loudly self-declares what is NOT wired, so the
 * honesty lives in the artifact instead of a README caveat.
 */
export function productionReadiness(nodes: ResourceNodeType[], edges: Edge[]): string {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const typeOf = (id: string) => byId.get(id)?.data.type
  const has = (t: ResourceType) => nodes.some((n) => n.data.type === t)
  const nodesOf = (t: ResourceType) => nodes.filter((n) => n.data.type === t)
  const hasIncoming = (nodeId: string, sourceType: ResourceType) =>
    edges.some((e) => e.target === nodeId && typeOf(e.source) === sourceType)

  const gaps: ReadinessGap[] = []

  // Unwired security blocks on the drawn graph (derivable, but the user didn't
  // connect them) — the most actionable class.
  for (const alb of nodesOf('alb')) {
    if (!hasIncoming(alb.id, 'acm')) {
      gaps.push({
        id: 'alb-plaintext-http',
        severity: 'high',
        title: `"${alb.data.label}" serves plaintext HTTP (no TLS)`,
        detail:
          'No ACM certificate is attached. Draw an `acm → alb` edge to emit an ' +
          'HTTPS:443 listener and redirect HTTP:80, or terminate TLS upstream.',
      })
    }
  }
  for (const api of nodesOf('apigw')) {
    if (!hasIncoming(api.id, 'cognito')) {
      gaps.push({
        id: 'apigw-open-auth',
        severity: 'high',
        title: `"${api.data.label}" is publicly invokable (authorization = NONE)`,
        detail:
          'No authorizer is attached. Draw a `cognito → apigw` edge for a ' +
          'COGNITO_USER_POOLS authorizer, or add IAM / a custom authorizer.',
      })
    }
  }

  // Out-of-scope by construction — the abstraction cannot represent these, so we
  // declare rather than emit half-measures.
  if (has('rds')) {
    gaps.push({
      id: 'app-secret-consumption',
      severity: 'high',
      title: 'App→DB credential consumption is not wired',
      detail:
        'RDS credentials live in a managed Secrets Manager secret ' +
        '(`manage_master_user_password`), but no IAM policy or environment ' +
        'injection grants EC2/ECS/EKS workloads read access to that secret ARN. ' +
        'Wire this in the application deploy, not the topology.',
    })
    gaps.push({
      id: 'aws-managed-kms',
      severity: 'medium',
      title: 'Encryption uses AWS-managed keys, not customer-managed (CMK)',
      detail:
        'RDS storage and the RDS-managed secret use the default AWS-managed KMS ' +
        'keys. Regulated/financial workloads should supply a CMK ' +
        '(`kms_key_id`, `master_user_secret_kms_key_id`).',
    })
  }
  if (has('vpc') || has('alb')) {
    gaps.push({
      id: 'no-audit-logging',
      severity: 'medium',
      title: 'No audit/flow logging is emitted',
      detail:
        'The export contains no VPC Flow Logs, CloudTrail, or ALB access logs. ' +
        'These have no canvas block; enable them out of band for auditability.',
    })
  }
  if (has('cloudfront')) {
    gaps.push({
      id: 'cloudfront-tls-waf-unwired',
      severity: 'medium',
      title: 'CloudFront TLS / WAF are not auto-wired',
      detail:
        'A CloudFront custom certificate must be in us-east-1 and its WAF must ' +
        'use scope=CLOUDFRONT — both need a multi-region provider the generator ' +
        'does not model. Add an aliased us-east-1 provider manually.',
    })
  }
  if (has('cloudwatch')) {
    gaps.push({
      id: 'alarms-no-action',
      severity: 'low',
      title: 'CloudWatch alarms have no notification action',
      detail:
        'Alarms are emitted without `alarm_actions`. Point them at an SNS topic ' +
        '(requires choosing the destination) to actually page on breach.',
    })
  }
  if (has('nat')) {
    gaps.push({
      id: 'single-nat-spof',
      severity: 'low',
      title: 'NAT Gateway is a per-AZ single point of failure',
      detail:
        'One NAT Gateway serves all private subnets. For AZ-fault tolerance, ' +
        'deploy one NAT per AZ with per-AZ private route tables.',
    })
  }

  const bySeverity = { high: 0, medium: 1, low: 2 }
  gaps.sort((a, b) => bySeverity[a.severity] - bySeverity[b.severity])

  const jsonBlock = JSON.stringify(
    { productionReady: gaps.length === 0, gaps: gaps.map(({ id, severity, title }) => ({ id, severity, title })) },
    null,
    2,
  )

  const list = gaps.length
    ? gaps
        .map(
          (g) => `### ${g.severity === 'high' ? '🔴' : g.severity === 'medium' ? '🟠' : '🟡'} ${g.title}
\`${g.id}\` · **${g.severity}**

${g.detail}`,
        )
        .join('\n\n')
    : 'No gaps known within the generator’s scope for this graph. Still review ' +
      'region, instance sizing, and organizational guardrails before applying.'

  return `# ⚠️ NOT PRODUCTION READY

This Terraform is **apply-ready** — \`terraform apply\` builds the drawn
architecture — but "applies cleanly" is not "production-ready". cidrunner is a
topology prototyping tool: it wires the blocks you draw safely, and declares
everything it does **not** cover below. Do not ship this to a regulated
environment without closing these gaps.

## Machine-readable summary

\`\`\`json
${jsonBlock}
\`\`\`

## Gaps

${list}

---
Generated by cidrunner (ADR 0056). This file is deterministic from your canvas.
`
}

/** Builds the exported file map (`main.tf`, `variables.tf`, …) for a graph. */
export function generateTerraform(
  nodes: ResourceNodeType[],
  edges: Edge[] = [],
  securityGroups: SecurityGroupDef[] = [],
): Record<string, string> {
  // SGs are a store collection + per-resource assignment (ADR 0059); project
  // them back into synthetic sg nodes + attachment edges so the edge-driven
  // emission below (and productionReadiness) is unchanged. No-op when empty.
  ;({ nodes, edges } = materializeSecurityGroups(nodes, edges, securityGroups))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const vpcOf = (n: ResourceNodeType) => ancestorOfType(n, 'vpc', byId)
  const typeOf = (id: string) => byId.get(id)?.data.type

  // SG-attachment edges (sg → resource) and ALB-target edges (alb → ec2).
  const attachedSGs = (nodeId: string) =>
    edges
      .filter((e) => e.target === nodeId && typeOf(e.source) === 'sg')
      .map((e) => tfName(e.source))
  const albTargets = (albId: string) =>
    edges
      .filter((e) => e.source === albId && typeOf(e.target) === 'ec2')
      .map((e) => tfName(e.target))
  // Security-attachment edges into a fronting service (ADR 0056): acm → alb
  // (TLS cert) and cognito → apigw (authorizer). Like SG edges, the source is
  // the security block and carries no traffic.
  const attachedSourceOf = (nodeId: string, sourceType: ResourceType) => {
    const e = edges.find((e) => e.target === nodeId && typeOf(e.source) === sourceType)
    return e ? tfName(e.source) : undefined
  }
  // rds → rds edge marks the target as a read replica of the source.
  const replicaSourceOf = (rdsId: string) => {
    const e = edges.find((e) => e.target === rdsId && typeOf(e.source) === 'rds')
    return e ? tfName(e.source) : undefined
  }
  const isReplica = (n: ResourceNodeType) =>
    n.data.type === 'rds' && replicaSourceOf(n.id) !== undefined
  // First outgoing edge into one of `kinds` → typed reference (CF origin, R53 alias).
  const firstTargetOf = (nodeId: string, kinds: ResourceType[]) => {
    const e = edges.find(
      (e) => e.source === nodeId && kinds.includes(typeOf(e.target) as ResourceType),
    )
    return e ? { kind: typeOf(e.target) as ResourceType, name: tfName(e.target) } : undefined
  }
  // Lambda consumers of a queue or stream (sqs → lambda, kinesis → lambda).
  const lambdaConsumers = (sourceId: string) =>
    edges
      .filter((e) => e.source === sourceId && typeOf(e.target) === 'lambda')
      .map((e) => tfName(e.target))
  const lambdaSqsSources = (lambdaId: string) =>
    edges
      .filter((e) => e.target === lambdaId && typeOf(e.source) === 'sqs')
      .map((e) => tfName(e.source))
  // All outgoing edges of `nodeId` whose target type is in `kinds` → typed refs
  // (SNS subscribers, CloudWatch monitor targets).
  const targetsOf = (nodeId: string, kinds: ResourceType[]) =>
    edges
      .filter((e) => e.source === nodeId && kinds.includes(typeOf(e.target) as ResourceType))
      .map((e) => ({ kind: typeOf(e.target) as ResourceType, name: tfName(e.target) }))

  // The port a resource listens on, for tiered SG ingress (ADR 0055).
  const servicePort = (n: ResourceNodeType): number | null => {
    switch (n.data.type) {
      case 'ec2':
      case 'ecs':
      case 'eks':
        return 80
      case 'rds':
        return String(n.data.config.engine) === 'postgres' ? 5432 : 3306
      case 'elasticache':
        return 6379
      case 'efs':
        return 2049
      default:
        return null
    }
  }
  // Tiered SG-to-SG ingress for an SG: for every resource it is attached to,
  // allow the SGs of whoever sends that resource traffic, on the target's port
  // (ALB SG → app:80, app SG → rds:3306, …). ADR 0055.
  const sgIngressFor = (sgId: string) => {
    const rules: { fromSg: string; port: number; desc: string }[] = []
    const seen = new Set<string>()
    for (const attach of edges) {
      if (attach.source !== sgId) continue // this SG's attachment edges (sg → resource)
      const target = byId.get(attach.target)
      if (!target) continue
      const port = servicePort(target)
      if (port === null) continue
      for (const t of edges) {
        if (t.target !== target.id) continue // traffic edges INTO the attached resource
        const srcType = typeOf(t.source)
        if (srcType === undefined || srcType === 'sg' || srcType === 'cloudwatch' || srcType === 'rds') {
          continue
        }
        for (const ssg of attachedSGs(t.source)) {
          const key = `${ssg}:${port}`
          if (seen.has(key)) continue
          seen.add(key)
          rules.push({ fromSg: ssg, port, desc: `from ${srcType} on ${port}` })
        }
      }
    }
    return rules
  }

  const subnetsIn = (vpcId: string) =>
    nodes.filter((n) => n.data.type === 'subnet' && vpcOf(n)?.id === vpcId)
  /** One subnet per distinct AZ (EFS mount targets are unique per AZ). */
  const oneSubnetPerAz = (subnets: ResourceNodeType[]) => {
    const seen = new Set<string>()
    const out: ResourceNodeType[] = []
    for (const s of subnets) {
      const az = String(s.data.config.az ?? 'a')
      if (!seen.has(az)) {
        seen.add(az)
        out.push(s)
      }
    }
    return out
  }

  const ordered = [...nodes].sort(
    (a, b) => ORDER.indexOf(a.data.type) - ORDER.indexOf(b.data.type),
  )

  const blocks = ordered
    .map((node) => {
      const vpc = vpcOf(node)
      const subnet = ancestorOfType(node, 'subnet', byId)
      const vpcSubnets = vpc ? subnetsIn(vpc.id) : []
      return getResource(node.data.type).terraform({
        name: tfName(node.id),
        awsName: awsName(node.id),
        displayName: node.data.label,
        config: node.data.config,
        refs: {
          vpc: vpc ? tfName(vpc.id) : undefined,
          subnet: subnet ? tfName(subnet.id) : undefined,
          subnets: vpcSubnets.map((s) => tfName(s.id)),
          publicSubnets: vpcSubnets
            .filter((s) => s.data.config.public === true)
            .map((s) => tfName(s.id)),
          privateSubnets: vpcSubnets
            .filter((s) => s.data.config.public !== true)
            .map((s) => tfName(s.id)),
          azUniqueSubnets: oneSubnetPerAz(vpcSubnets).map((s) => tfName(s.id)),
          securityGroups: attachedSGs(node.id),
          targets: node.data.type === 'alb' ? albTargets(node.id) : undefined,
          replicaSource: node.data.type === 'rds' ? replicaSourceOf(node.id) : undefined,
          originTarget:
            node.data.type === 'cloudfront'
              ? firstTargetOf(node.id, ['alb', 's3', 'apigw'])
              : undefined,
          aliasTarget:
            node.data.type === 'route53'
              ? firstTargetOf(node.id, ['cloudfront', 'alb'])
              : undefined,
          consumers:
            node.data.type === 'sqs' || node.data.type === 'kinesis'
              ? lambdaConsumers(node.id)
              : undefined,
          sqsSources: node.data.type === 'lambda' ? lambdaSqsSources(node.id) : undefined,
          kmsKey:
            node.data.type === 'secretsmanager'
              ? firstTargetOf(node.id, ['kms'])?.name
              : undefined,
          integrationTarget:
            node.data.type === 'apigw'
              ? firstTargetOf(node.id, ['lambda'])?.name
              : undefined,
          logBucket:
            node.data.type === 'cloudtrail'
              ? firstTargetOf(node.id, ['s3'])?.name
              : undefined,
          deliveryBucket:
            node.data.type === 'kinesis'
              ? firstTargetOf(node.id, ['s3'])?.name
              : undefined,
          certificate:
            node.data.type === 'alb' ? attachedSourceOf(node.id, 'acm') : undefined,
          authorizer:
            node.data.type === 'apigw' ? attachedSourceOf(node.id, 'cognito') : undefined,
          sgIngress: node.data.type === 'sg' ? sgIngressFor(node.id) : undefined,
          subscribers:
            node.data.type === 'sns' ? targetsOf(node.id, ['sqs', 'lambda']) : undefined,
          monitorTargets:
            node.data.type === 'cloudwatch'
              ? targetsOf(node.id, ['ec2', 'rds', 'alb', 'lambda'])
              : undefined,
        },
      })
    })
    .filter((b) => b.trim() !== '')

  // ---- Derived plumbing the canvas doesn't draw ------------------------------

  const derived: string[] = []
  const vpcs = nodes.filter((n) => n.data.type === 'vpc')

  for (const vpc of vpcs) {
    const v = tfName(vpc.id)
    const vSubnets = subnetsIn(vpc.id)
    const publicSubnets = vSubnets.filter((s) => s.data.config.public === true)
    const privateSubnets = vSubnets.filter((s) => s.data.config.public !== true)
    const igw = nodes.find((n) => n.data.type === 'igw' && vpcOf(n)?.id === vpc.id)
    const nat = nodes.find((n) => n.data.type === 'nat' && vpcOf(n)?.id === vpc.id)
    // Replicas inherit the source's subnet group — only primaries need one.
    const hasRds = nodes.some(
      (n) => n.data.type === 'rds' && !isReplica(n) && vpcOf(n)?.id === vpc.id,
    )
    const hasCache = nodes.some(
      (n) => n.data.type === 'elasticache' && vpcOf(n)?.id === vpc.id,
    )

    // Public route table: 0.0.0.0/0 → IGW, associated to public subnets.
    if (igw && publicSubnets.length > 0) {
      derived.push(`resource "aws_route_table" "${v}_public" {
  vpc_id = aws_vpc.${v}.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.${tfName(igw.id)}.id
  }
  tags = { Name = "${vpc.data.label}-public" }
}`)
      for (const s of publicSubnets) {
        derived.push(`resource "aws_route_table_association" "${tfName(s.id)}_public" {
  subnet_id      = aws_subnet.${tfName(s.id)}.id
  route_table_id = aws_route_table.${v}_public.id
}`)
      }
    }

    // Private route table: 0.0.0.0/0 → NAT, associated to private subnets.
    if (nat && privateSubnets.length > 0) {
      derived.push(`resource "aws_route_table" "${v}_private" {
  vpc_id = aws_vpc.${v}.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.${tfName(nat.id)}.id
  }
  tags = { Name = "${vpc.data.label}-private" }
}`)
      for (const s of privateSubnets) {
        derived.push(`resource "aws_route_table_association" "${tfName(s.id)}_private" {
  subnet_id      = aws_subnet.${tfName(s.id)}.id
  route_table_id = aws_route_table.${v}_private.id
}`)
      }
    }

    // DB subnet group — PRIVATE subnets only (a DB must never land in a public
    // subnet); fall back to all subnets only if the VPC has no private ones
    // (ADR 0055). RDS still requires ≥2 AZs — enforced by checks.
    if (hasRds && vSubnets.length > 0) {
      const dbSubnets = privateSubnets.length >= 2 ? privateSubnets : vSubnets
      derived.push(`resource "aws_db_subnet_group" "${v}_dbsg" {
  name_prefix = "${awsName(vpc.id).toLowerCase()}-"
  subnet_ids  = [${dbSubnets.map((s) => `aws_subnet.${tfName(s.id)}.id`).join(', ')}]
}`)
    }

    // Cache subnet group (ElastiCache also needs subnets across ≥2 AZs).
    if (hasCache && vSubnets.length > 0) {
      derived.push(`resource "aws_elasticache_subnet_group" "${v}_cachesg" {
  name       = "${awsName(vpc.id).toLowerCase()}-cache"
  subnet_ids = [${vSubnets.map((s) => `aws_subnet.${tfName(s.id)}.id`).join(', ')}]
}`)
    }
  }

  // CloudTrail bucket policy (ADR 0062): a `cloudtrail → s3` edge delivers logs
  // to that bucket, which needs a policy granting the CloudTrail service
  // GetBucketAcl + PutObject — derived plumbing the canvas doesn't draw.
  for (const trail of nodes.filter((n) => n.data.type === 'cloudtrail')) {
    const bucketEdge = edges.find(
      (e) => e.source === trail.id && typeOf(e.target) === 's3',
    )
    if (!bucketEdge) continue
    const t = tfName(trail.id)
    const bucket = tfName(bucketEdge.target)
    derived.push(`data "aws_caller_identity" "${t}_current" {}

resource "aws_s3_bucket_policy" "${t}_bucket_policy" {
  bucket = aws_s3_bucket.${bucket}.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.${bucket}.arn
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "\${aws_s3_bucket.${bucket}.arn}/AWSLogs/\${data.aws_caller_identity.${t}_current.account_id}/*"
        Condition = { StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" } }
      }
    ]
  })
}`)
  }

  // WAF associations (ADR 0056): a `waf → alb|apigw` edge binds the web ACL to
  // that target. ALB associates by its ARN; a REST API by its stage ARN.
  for (const waf of nodes.filter((n) => n.data.type === 'waf')) {
    for (const e of edges.filter((e) => e.source === waf.id)) {
      const targetType = typeOf(e.target)
      const t = tfName(e.target)
      const resourceArn =
        targetType === 'alb'
          ? `aws_lb.${t}.arn`
          : targetType === 'apigw'
            ? `aws_api_gateway_stage.${t}.arn`
            : undefined
      if (!resourceArn) continue
      derived.push(`resource "aws_wafv2_web_acl_association" "${tfName(waf.id)}_${t}" {
  resource_arn = ${resourceArn}
  web_acl_arn  = aws_wafv2_web_acl.${tfName(waf.id)}.arn
}`)
    }
  }

  const hasType = (t: ResourceType) => nodes.some((n) => n.data.type === t)
  const needsAmiLookup = nodes.some(
    (n) =>
      n.data.type === 'ec2' &&
      !(typeof n.data.config.ami === 'string' && n.data.config.ami.startsWith('ami-')),
  )

  const dataBlocks = needsAmiLookup
    ? `data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }
}

`
    : ''

  const providers = hasType('lambda')
    ? `    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }`
    : `    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }`

  const mainTf = `# Generated by cidrunner — https://nextchans.github.io/cidrunner/
# Designed to be apply-ready: \`terraform init && terraform apply\` creates the
# drawn architecture. Review instance sizes and the region before applying —
# NAT Gateway, ALB, and RDS incur hourly cost.

terraform {
  required_version = ">= 1.5"
  required_providers {
${providers}
  }
}

provider "aws" {
  region = var.aws_region
}

${dataBlocks}${blocks.join('\n\n')}${derived.length ? '\n\n# --- Derived networking (route tables, associations, subnet groups) ---\n\n' + derived.join('\n\n') : ''}
`

  const vars: string[] = [
    `variable "aws_region" {
  type        = string
  description = "AWS region to deploy into"
  default     = "ap-northeast-2"
}`,
  ]
  // RDS credentials are now managed by AWS Secrets Manager
  // (`manage_master_user_password`) — no db_password variable / plaintext (ADR 0055).

  // Outputs — the things an engineer immediately wants after apply.
  const outputs: string[] = []
  for (const n of nodes) {
    const name = tfName(n.id)
    if (n.data.type === 'alb') {
      outputs.push(`output "${name}_dns_name" {
  description = "${n.data.label} DNS name"
  value       = aws_lb.${name}.dns_name
}`)
    }
    if (n.data.type === 'lambda') {
      outputs.push(`output "${name}_function_arn" {
  description = "${n.data.label} function ARN"
  value       = aws_lambda_function.${name}.arn
}`)
    }
    if (n.data.type === 'apigw') {
      outputs.push(`output "${name}_invoke_url" {
  description = "${n.data.label} invoke URL"
  value       = aws_api_gateway_stage.${name}.invoke_url
}`)
    }
    if (n.data.type === 's3') {
      outputs.push(`output "${name}_bucket" {
  description = "${n.data.label} bucket name"
  value       = aws_s3_bucket.${name}.id
}`)
    }
    if (n.data.type === 'rds') {
      outputs.push(`output "${name}_endpoint" {
  description = "${n.data.label} connection endpoint"
  value       = aws_db_instance.${name}.endpoint
}`)
    }
    if (n.data.type === 'cloudfront') {
      outputs.push(`output "${name}_domain" {
  description = "${n.data.label} distribution domain"
  value       = aws_cloudfront_distribution.${name}.domain_name
}`)
    }
    if (n.data.type === 'route53') {
      outputs.push(`output "${name}_name_servers" {
  description = "${n.data.label} zone name servers"
  value       = aws_route53_zone.${name}.name_servers
}`)
    }
    if (n.data.type === 'dynamodb') {
      outputs.push(`output "${name}_table" {
  description = "${n.data.label} table name"
  value       = aws_dynamodb_table.${name}.name
}`)
    }
    if (n.data.type === 'sqs') {
      outputs.push(`output "${name}_queue_url" {
  description = "${n.data.label} queue URL"
  value       = aws_sqs_queue.${name}.url
}`)
    }
    if (n.data.type === 'sns') {
      outputs.push(`output "${name}_topic_arn" {
  description = "${n.data.label} topic ARN"
  value       = aws_sns_topic.${name}.arn
}`)
    }
    if (n.data.type === 'elasticache') {
      outputs.push(`output "${name}_cache_address" {
  description = "${n.data.label} configuration endpoint"
  value       = aws_elasticache_cluster.${name}.cache_nodes[0].address
}`)
    }
    if (n.data.type === 'efs') {
      outputs.push(`output "${name}_file_system_id" {
  description = "${n.data.label} file system id"
  value       = aws_efs_file_system.${name}.id
}`)
    }
    if (n.data.type === 'ecs') {
      outputs.push(`output "${name}_cluster_name" {
  description = "${n.data.label} ECS cluster name"
  value       = aws_ecs_cluster.${name}.name
}`)
    }
    if (n.data.type === 'eks') {
      outputs.push(`output "${name}_cluster_endpoint" {
  description = "${n.data.label} EKS API endpoint"
  value       = aws_eks_cluster.${name}.endpoint
}`)
    }
    if (n.data.type === 'cloudwatch') {
      outputs.push(`output "${name}_log_group" {
  description = "${n.data.label} log group name"
  value       = aws_cloudwatch_log_group.${name}.name
}`)
    }
    if (n.data.type === 'kinesis') {
      outputs.push(`output "${name}_stream_arn" {
  description = "${n.data.label} stream ARN"
  value       = aws_kinesis_stream.${name}.arn
}`)
    }
    if (n.data.type === 'cognito') {
      outputs.push(`output "${name}_user_pool_id" {
  description = "${n.data.label} user pool id"
  value       = aws_cognito_user_pool.${name}.id
}`)
    }
    if (n.data.type === 'kms') {
      outputs.push(`output "${name}_key_arn" {
  description = "${n.data.label} key ARN"
  value       = aws_kms_key.${name}.arn
}`)
    }
    if (n.data.type === 'secretsmanager') {
      outputs.push(`output "${name}_secret_arn" {
  description = "${n.data.label} secret ARN"
  value       = aws_secretsmanager_secret.${name}.arn
}`)
    }
    if (n.data.type === 'acm') {
      outputs.push(`output "${name}_certificate_arn" {
  description = "${n.data.label} certificate ARN"
  value       = aws_acm_certificate.${name}.arn
}`)
    }
    if (n.data.type === 'waf') {
      outputs.push(`output "${name}_web_acl_arn" {
  description = "${n.data.label} web ACL ARN"
  value       = aws_wafv2_web_acl.${name}.arn
}`)
    }
  }

  const readme = `# cidrunner Terraform export

Generated from your cidrunner canvas. This configuration is **apply-ready**:

\`\`\`bash
terraform init
terraform plan
terraform apply
\`\`\`

Notes:
- EC2 AMIs set to \`auto\` resolve to the latest Amazon Linux 2023 via a data source.
- Route tables and associations are derived from your topology (IGW → public,
  NAT → private).
${hasType('rds') ? '- RDS credentials are managed by AWS Secrets Manager (`manage_master_user_password`)\n  — no plaintext password. The DB subnet group spans the VPC\'s PRIVATE subnets;\n  Security Groups allow the app tier in on the DB port.\n' : ''}${hasType('lambda') ? '- Lambda ships an inline hello-world package (archive provider) and an IAM\n  execution role.\n' : ''}${hasType('apigw') ? '- API Gateway proxies to the Lambda it is connected to (apigw → lambda edge)\n  via an AWS_PROXY `{proxy+}` integration — the invoke URL is in the outputs.\n' : ''}${hasType('acm') ? '- An `acm → alb` edge makes that ALB terminate TLS (HTTPS:443 listener +\n  HTTP:80 redirect). The certificate stays PENDING_VALIDATION until its DNS\n  records are published.\n' : ''}${hasType('waf') ? '- A `waf → alb|apigw` edge associates the Web ACL to that target.\n' : ''}${hasType('cognito') ? '- A `cognito → apigw` edge guards the API with a COGNITO_USER_POOLS authorizer.\n' : ''}- **Read \`PRODUCTION-READINESS.md\`** — it lists, machine-readably, what this
  export does NOT cover (audit logs, app secret consumption, CMK, …).
- **Cost warning**: NAT Gateway, ALB, and RDS bill hourly. \`terraform destroy\`
  when you are done.
`

  const files: Record<string, string> = {
    'main.tf': mainTf,
    'variables.tf': vars.join('\n\n') + '\n',
    'README.md': readme,
    'PRODUCTION-READINESS.md': productionReadiness(nodes, edges),
  }
  if (outputs.length) files['outputs.tf'] = outputs.join('\n\n') + '\n'
  return files
}

/** Generates the Terraform files and triggers a browser zip download. */
export async function downloadTerraformZip(
  nodes: ResourceNodeType[],
  edges: Edge[] = [],
  securityGroups: SecurityGroupDef[] = [],
): Promise<void> {
  const files = generateTerraform(nodes, edges, securityGroups)
  // Lazy-load JSZip so the ~100 kB library ships in its own chunk, fetched only
  // when the user actually exports (ADR 0029).
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const [filename, content] of Object.entries(files)) {
    zip.file(filename, content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'cidrunner-terraform.zip'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
