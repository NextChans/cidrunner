import JSZip from 'jszip'
import type { Edge } from '@xyflow/react'
import { getResource, type ResourceType } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'

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
  'vpc', 'subnet', 'igw', 'nat', 'sg', 'efs', 'alb', 'ec2', 'ecs', 'eks',
  'rds', 'elasticache', 's3', 'dynamodb', 'sqs', 'sns', 'lambda', 'cloudwatch',
  'cloudfront', 'route53',
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

/** Builds the exported file map (`main.tf`, `variables.tf`, …) for a graph. */
export function generateTerraform(
  nodes: ResourceNodeType[],
  edges: Edge[] = [],
): Record<string, string> {
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
  const sqsConsumers = (sqsId: string) =>
    edges
      .filter((e) => e.source === sqsId && typeOf(e.target) === 'lambda')
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
              ? firstTargetOf(node.id, ['alb', 's3', 'lambda'])
              : undefined,
          aliasTarget:
            node.data.type === 'route53'
              ? firstTargetOf(node.id, ['cloudfront', 'alb'])
              : undefined,
          consumers: node.data.type === 'sqs' ? sqsConsumers(node.id) : undefined,
          sqsSources: node.data.type === 'lambda' ? lambdaSqsSources(node.id) : undefined,
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

    // DB subnet group (RDS requires subnets across ≥2 AZs — enforced by checks).
    if (hasRds && vSubnets.length > 0) {
      derived.push(`resource "aws_db_subnet_group" "${v}_dbsg" {
  name_prefix = "${awsName(vpc.id).toLowerCase()}-"
  subnet_ids  = [${vSubnets.map((s) => `aws_subnet.${tfName(s.id)}.id`).join(', ')}]
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

  const hasType = (t: ResourceType) => nodes.some((n) => n.data.type === t)
  // A replica inherits credentials — db_password is only for primaries.
  const hasPrimaryRds = nodes.some((n) => n.data.type === 'rds' && !isReplica(n))
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
  if (hasPrimaryRds) {
    vars.push(`variable "db_password" {
  type        = string
  description = "Master password for RDS (pass with -var or TF_VAR_db_password)"
  sensitive   = true
}`)
  }

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
      outputs.push(`output "${name}_api_endpoint" {
  description = "${n.data.label} HTTP API endpoint"
  value       = aws_apigatewayv2_api.${name}_api.api_endpoint
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
  }

  const readme = `# cidrunner Terraform export

Generated from your cidrunner canvas. This configuration is **apply-ready**:

\`\`\`bash
terraform init
terraform plan${hasType('rds') ? ' -var db_password=YOUR_SECURE_PASSWORD' : ''}
terraform apply${hasType('rds') ? ' -var db_password=YOUR_SECURE_PASSWORD' : ''}
\`\`\`

Notes:
- EC2 AMIs set to \`auto\` resolve to the latest Amazon Linux 2023 via a data source.
- Route tables and associations are derived from your topology (IGW → public,
  NAT → private).
${hasType('rds') ? '- RDS requires `db_password` (no default; it is marked sensitive).\n- The DB subnet group spans the subnets of the VPC that contains the RDS.\n' : ''}${hasType('lambda') ? '- Lambda ships an inline hello-world package (archive provider) and a working\n  API Gateway HTTP API — the endpoint is in the outputs.\n' : ''}- **Cost warning**: NAT Gateway, ALB, and RDS bill hourly. \`terraform destroy\`
  when you are done.
`

  const files: Record<string, string> = {
    'main.tf': mainTf,
    'variables.tf': vars.join('\n\n') + '\n',
    'README.md': readme,
  }
  if (outputs.length) files['outputs.tf'] = outputs.join('\n\n') + '\n'
  return files
}

/** Generates the Terraform files and triggers a browser zip download. */
export async function downloadTerraformZip(
  nodes: ResourceNodeType[],
  edges: Edge[] = [],
): Promise<void> {
  const files = generateTerraform(nodes, edges)
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
