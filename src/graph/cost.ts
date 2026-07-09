import type { ResourceNodeType } from '@/store/useGraphStore'
import type { ResourceType } from '@/resources/types'

/**
 * Rough monthly cost model (ADR 0051) for the Budget game mode. These are
 * deliberately *approximate* USD/month estimates — game-balance figures, not a
 * billing calculator — kept in one place so they are easy to tune. They lean on
 * the real AWS cost traps the game should teach: a NAT Gateway, ALB, RDS, and an
 * EKS control plane cost real money every hour, while VPC/Subnet/IGW/SG and the
 * organizational Account/AZ boxes are free, and usage-billed services
 * (S3/Lambda/DynamoDB/SQS/SNS) are treated as a small nominal figure.
 *
 * Cost lives here rather than on `ResourceMeta` on purpose: it is a cross-cutting
 * balance knob, not an intrinsic resource property, so tuning stays in one file.
 */

type Cfg = Record<string, unknown>
type Cost = number | ((cfg: Cfg) => number)

const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** EC2 on-demand ≈ USD/month by instance type (ap-northeast-2, rounded). */
const EC2_MONTHLY: Record<string, number> = {
  't3.micro': 8,
  't3.small': 15,
  't3.medium': 30,
  't3.large': 60,
  'm5.large': 70,
  'c5.large': 62,
}

/** RDS single-AZ ≈ USD/month by instance class (doubled for multi-AZ). */
const RDS_MONTHLY: Record<string, number> = {
  'db.t3.micro': 13,
  'db.t3.small': 25,
  'db.t3.medium': 50,
  'db.m5.large': 130,
}

/** Per-resource monthly cost estimate. Missing types default to 0 (free). */
const RESOURCE_COST: Partial<Record<ResourceType, Cost>> = {
  // Network plumbing & organizational boxes — free.
  account: 0,
  az: 0,
  vpc: 0,
  subnet: 0,
  igw: 0,
  sg: 0,
  // The infamous hourly billers.
  nat: 32, // NAT Gateway — the classic "why is my bill $32?" trap
  alb: 16,
  eks: 73, // EKS control plane alone, before any nodes
  ecs: 18, // a small Fargate service
  ec2: (c) => EC2_MONTHLY[String(c.instance_type)] ?? 15,
  rds: (c) => (RDS_MONTHLY[String(c.instance_class)] ?? 25) * (c.multi_az === true ? 2 : 1),
  elasticache: 13,
  efs: 3,
  cloudwatch: 3,
  waf: 6,
  kms: 1,
  secretsmanager: 1,
  route53: 1,
  cloudfront: 1,
  apigw: 1,
  kinesis: (c) =>
    String(c.mode) === 'PROVISIONED' ? 11 * num(c.shard_count, 1) : 12,
  // Usage-billed — nominal for the game.
  s3: 1,
  dynamodb: 0,
  sqs: 0,
  sns: 0,
  lambda: 0,
  cognito: 0,
  acm: 0,
}

/** Estimated monthly USD for a single node. */
export function nodeMonthlyCost(node: ResourceNodeType): number {
  const spec = RESOURCE_COST[node.data.type]
  if (spec === undefined) return 0
  return typeof spec === 'function' ? spec(node.data.config) : spec
}

/** Estimated total monthly USD for the whole graph (rounded). */
export function estimateMonthlyCost(nodes: ResourceNodeType[]): number {
  return Math.round(nodes.reduce((sum, n) => sum + nodeMonthlyCost(n), 0))
}
