import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import { isSgAssignable } from '@/graph/securityGroups'
import { getMission } from '@/missions'
import { getResource, type ResourceType } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { MissionCheckContext } from '@/missions/types'
import type { SecurityGroupDef } from '@/graph/securityGroups'
import { E, N } from './helpers'

/** The canonical Web SG assigned across 3-tier builds (ADR 0059). */
const WEB_SG: SecurityGroupDef = {
  id: 'sg-6',
  name: 'Web SG',
  allowHttp: true,
  allowHttps: true,
  allowSsh: false,
}
/** A second SG def used by the assignment-rules block. */
const WEB_SG_2: SecurityGroupDef = {
  id: 'sg-2',
  name: 'SG',
  allowHttp: true,
  allowHttps: true,
  allowSsh: false,
}
/** Assigns a security group to a resource config (mirrors the store). */
const withSg = (sgId: string) => ({ securityGroupIds: [sgId] })

/** Builds a live mission-check context exactly as the MissionPanel does. */
function ctxFor(
  nodes: ResourceNodeType[],
  edges: Edge[],
  securityGroups: SecurityGroupDef[] = [],
): MissionCheckContext {
  const issues = graphIssues(nodes, edges, securityGroups)
  const allValid = nodes.every(
    (n) =>
      (getResource(n.data.type).validate?.(n.data.config) ?? []).length === 0 &&
      (issues.errors.get(n.id)?.length ?? 0) === 0,
  )
  const securityOk = nodes.every((n) => (issues.warnings.get(n.id)?.length ?? 0) === 0)
  return { nodes, edges, securityGroups, sim: simulate(nodes, edges), allValid, securityOk, issues }
}

const stars = (
  id: string,
  nodes: ResourceNodeType[],
  edges: Edge[],
  securityGroups: SecurityGroupDef[] = [],
) => getMission(id)!.check!(ctxFor(nodes, edges, securityGroups))

/**
 * The store's initial seed graph (VPC ▸ public Subnet ▸ EC2, no SG). A fresh
 * player carries this into every mission; a non-VPC mission never touches it.
 */
function seed(): ResourceNodeType[] {
  return [
    N('seed-vpc', 'vpc', undefined, { cidr_block: '10.9.0.0/16' }, 'VPC'),
    N('seed-subnet', 'subnet', 'seed-vpc', { cidr_block: '10.9.1.0/24', az: 'a', public: true }, 'Public Subnet'),
    N('seed-ec2', 'ec2', 'seed-subnet', { instance_type: 't3.micro', ami: 'auto' }, 'EC2 Instance'),
  ]
}

// ── Canonical, clean, 3-star builds for every mission ──────────────────────

function tutorialBuild() {
  return {
    id: 'tutorial',
    nodes: [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('igw-2', 'igw', 'vpc-1', {}),
    ],
    edges: [] as Edge[],
  }
}

function vpcThreeTier(missionId: string) {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
    N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }),
    N('igw-5', 'igw', 'vpc-1', {}),
    N('alb-7', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...withSg('sg-6') }),
    N('ec2-8', 'ec2', 'subnet-3', { instance_type: 't3.micro', ami: 'auto', ...withSg('sg-6') }),
    N('rds-9', 'rds', 'subnet-4', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true, multi_az: true, ...withSg('sg-6') }),
  ]
  const edges = [E('t1', 'alb-7', 'ec2-8'), E('t2', 'ec2-8', 'rds-9')]
  return { id: missionId, nodes, edges, sg: [WEB_SG] }
}

function serverlessBuild() {
  return {
    id: 'serverless',
    nodes: [
      N('apigw-0', 'apigw', undefined, { stage_name: 'prod', endpoint_type: 'regional' }),
      N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('s3-2', 's3', undefined, { versioning: true, encryption: true, block_public_access: true }),
    ],
    edges: [E('t0', 'apigw-0', 'lambda-1'), E('t1', 'lambda-1', 's3-2')],
  }
}

function staticCdnBuild(blockPublic = true) {
  return {
    id: 'static-cdn',
    nodes: [
      N('route53-1', 'route53', undefined, { domain_name: 'example.com' }),
      N('cloudfront-2', 'cloudfront', undefined, { price_class: 'PriceClass_200' }),
      N('s3-3', 's3', undefined, { versioning: false, encryption: true, block_public_access: blockPublic }),
    ],
    edges: [E('e1', 'route53-1', 'cloudfront-2'), E('e2', 'cloudfront-2', 's3-3')],
  }
}

function asyncBuild() {
  return {
    id: 'async-pipeline',
    nodes: [
      N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('sqs-2', 'sqs', undefined, { fifo: false, visibility_timeout: 30 }),
      N('lambda-3', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('dynamodb-4', 'dynamodb', undefined, { billing_mode: 'PAY_PER_REQUEST', hash_key: 'id' }),
    ],
    edges: [E('e1', 'lambda-1', 'sqs-2'), E('e2', 'sqs-2', 'lambda-3'), E('e3', 'lambda-3', 'dynamodb-4')],
  }
}

function containerBuild() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
    N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }),
    N('igw-5', 'igw', 'vpc-1', {}),
    N('alb-7', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...withSg('sg-6') }),
    N('ecs-8', 'ecs', 'vpc-1', { cpu: '512', desired_count: 2, ...withSg('sg-6') }),
    N('rds-9', 'rds', 'subnet-4', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true, ...withSg('sg-6') }),
  ]
  const edges = [E('t1', 'alb-7', 'ecs-8'), E('t2', 'ecs-8', 'rds-9')]
  return { id: 'container-workload', nodes, edges, sg: [WEB_SG] }
}

function globalWebBuild() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
    N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }),
    N('igw-5', 'igw', 'vpc-1', {}),
    N('alb-7', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...withSg('sg-6') }),
    N('ec2-8', 'ec2', 'subnet-3', { instance_type: 't3.micro', ami: 'auto', ...withSg('sg-6') }),
    N('rds-9', 'rds', 'subnet-4', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true, ...withSg('sg-6') }),
    N('cloudfront-10', 'cloudfront', undefined, { price_class: 'PriceClass_200' }),
    N('route53-11', 'route53', undefined, { domain_name: 'example.com' }),
  ]
  const edges = [
    E('t1', 'alb-7', 'ec2-8'), E('t2', 'ec2-8', 'rds-9'),
    E('o1', 'cloudfront-10', 'alb-7'), E('d1', 'route53-11', 'cloudfront-10'),
  ]
  return { id: 'global-web', nodes, edges, sg: [WEB_SG] }
}

function eventBuild() {
  return {
    id: 'event-driven',
    nodes: [
      N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('sns-2', 'sns', undefined, { display_name: '' }),
      N('sqs-3', 'sqs', undefined, { fifo: false, visibility_timeout: 30 }),
      N('lambda-4', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('dynamodb-5', 'dynamodb', undefined, { billing_mode: 'PAY_PER_REQUEST', hash_key: 'id' }),
    ],
    edges: [E('e1', 'lambda-1', 'sns-2'), E('e2', 'sns-2', 'sqs-3'), E('e3', 'sqs-3', 'lambda-4'), E('e4', 'lambda-4', 'dynamodb-5')],
  }
}

function drBuild() {
  return {
    id: 'disaster-recovery',
    nodes: [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
      N('rds-3', 'rds', 'subnet-1', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, multi_az: true, storage_encrypted: true }),
      N('rds-4', 'rds', 'subnet-2', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true }),
    ],
    edges: [E('r1', 'rds-3', 'rds-4')],
  }
}

function dataPipelineBuild() {
  return {
    id: 'data-pipeline',
    nodes: [
      N('kinesis-1', 'kinesis', undefined, { mode: 'ON_DEMAND', shard_count: 1, retention_hours: 24 }),
      N('lambda-2', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('s3-3', 's3', undefined, { versioning: true, encryption: true, block_public_access: true }),
    ],
    edges: [E('t1', 'kinesis-1', 'lambda-2'), E('t2', 'lambda-2', 's3-3')],
  }
}

function secureAuthBuild() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
    N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }),
    N('igw-5', 'igw', 'vpc-1', {}),
    N('alb-7', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...withSg('sg-6') }),
    N('ec2-8', 'ec2', 'subnet-3', { instance_type: 't3.micro', ami: 'auto', ...withSg('sg-6') }),
    N('rds-9', 'rds', 'subnet-4', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true, ...withSg('sg-6') }),
    N('cloudfront-10', 'cloudfront', undefined, { price_class: 'PriceClass_200' }),
    N('cognito-11', 'cognito', undefined, { mfa: 'OPTIONAL', password_min_length: 12, email_verification: true }),
    N('secrets-12', 'secretsmanager', undefined, { recovery_window_days: 30 }),
    N('acm-14', 'acm', undefined, { domain_name: 'example.com', validation_method: 'DNS' }),
    N('waf-15', 'waf', undefined, { rate_limit: 2000, managed_common_rules: true }),
  ]
  const edges = [
    E('o1', 'cloudfront-10', 'alb-7'), E('t1', 'alb-7', 'ec2-8'), E('t2', 'ec2-8', 'rds-9'),
  ]
  return { id: 'secure-auth-web', nodes, edges, sg: [WEB_SG] }
}

/** All twelve canonical builds, keyed by mission id. */
const BUILDS = [
  tutorialBuild(),
  vpcThreeTier('three-tier'),
  serverlessBuild(),
  staticCdnBuild(true),
  asyncBuild(),
  containerBuild(),
  globalWebBuild(),
  eventBuild(),
  vpcThreeTier('security-hardening'),
  drBuild(),
  dataPipelineBuild(),
  secureAuthBuild(),
]

/** Non-VPC missions whose canonical build never touches the seed graph. */
const SEED_SAFE = [
  staticCdnBuild(true),
  asyncBuild(),
  serverlessBuild(),
  eventBuild(),
  dataPipelineBuild(),
]

describe('mission checker audit (ADR 0041)', () => {
  it('every canonical build clears its mission at three stars', () => {
    for (const b of BUILDS) {
      const sg = ('sg' in b ? b.sg : []) as SecurityGroupDef[]
      expect(stars(b.id, b.nodes, b.edges, sg), `${b.id} clean build`).toBe(3)
    }
  })

  it('every mission clears three stars even with the leftover starter seed on canvas', () => {
    // Regression lock: the seed's SG-less EC2 raises a security warning that used
    // to pin these non-VPC missions at ★2 with an irrelevant hint.
    for (const b of SEED_SAFE) {
      const withSeed = [...seed(), ...b.nodes]
      expect(stars(b.id, withSeed, b.edges), `${b.id} + seed`).toBe(3)
    }
  })

  it('static CDN caps at two stars when the S3 bucket is left public (in-build warning)', () => {
    const b = staticCdnBuild(false)
    expect(stars(b.id, b.nodes, b.edges)).toBe(2)
    // …and the seed must not change that verdict either way.
    expect(stars(b.id, [...seed(), ...b.nodes], b.edges)).toBe(2)
  })

  it('security hardening still honours an SSH-open SG inside the build (no false 3★)', () => {
    const b = vpcThreeTier('security-hardening')
    // Flip the assigned SG to open SSH (ADR 0059): the warning now surfaces on
    // every wearing resource, so it still scopes into the build and caps stars.
    const sg = [{ ...b.sg[0]!, allowSsh: true }]
    expect(stars('security-hardening', b.nodes, b.edges, sg)).toBeLessThan(3)
  })

  it('async pipeline clears with an API Gateway in front of the producer + an S3 fork', () => {
    // The reported topology: API GW → Lambda(producer) → SQS → Lambda(consumer)
    // → DynamoDB, where the producer ALSO writes S3. The producer is no longer
    // the entry (apigw is) and forks to a sink, yet the pipeline must clear —
    // grading matches the live chain structurally, not the single traced path.
    const nodes = [
      N('apigw-0', 'apigw', undefined, { stage_name: 'prod', endpoint_type: 'regional' }),
      N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('sqs-2', 'sqs', undefined, { fifo: false, visibility_timeout: 30 }),
      N('lambda-3', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }),
      N('dynamodb-4', 'dynamodb', undefined, { billing_mode: 'PAY_PER_REQUEST', hash_key: 'id' }),
      N('s3-5', 's3', undefined, { versioning: true, encryption: true, block_public_access: true }),
    ]
    const edges = [
      E('a0', 'apigw-0', 'lambda-1'),
      E('e1', 'lambda-1', 'sqs-2'),
      E('e2', 'sqs-2', 'lambda-3'),
      E('e3', 'lambda-3', 'dynamodb-4'),
      E('f1', 'lambda-1', 's3-5'),
    ]
    expect(stars('async-pipeline', nodes, edges)).toBe(3)
  })

  it('container-workload clears when the ALB also fans out to an EC2 branch', () => {
    // Reported topology: an ALB load-balances to BOTH an EC2 and an EKS cluster,
    // and both reach the RDS. The single traced flow might take the EC2 branch,
    // hiding the container path — but the mission grades the live chain
    // structurally, so ALB → EKS → RDS is found regardless.
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
      N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
      N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }),
      N('igw-5', 'igw', 'vpc-1', {}),
      N('alb-7', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...withSg('sg-6') }),
      N('ec2-8', 'ec2', 'subnet-3', { instance_type: 't3.micro', ami: 'auto', ...withSg('sg-6') }),
      N('eks-9', 'eks', 'vpc-1', { k8s_version: '1.31', node_instance_type: 't3.medium', ...withSg('sg-6') }),
      N('rds-10', 'rds', 'subnet-4', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true, ...withSg('sg-6') }),
    ]
    const edges = [
      E('t1', 'alb-7', 'ec2-8'), // EC2 fan-out branch (drawn first)
      E('t2', 'alb-7', 'eks-9'), // container branch
      E('t3', 'ec2-8', 'rds-10'),
      E('t4', 'eks-9', 'rds-10'),
    ]
    expect(stars('container-workload', nodes, edges, [WEB_SG])).toBeGreaterThanOrEqual(1)
  })

  it('security-hardening clears when the ALB also fans out to a container branch', () => {
    // The ALB load-balances to an EKS (drawn first, reaching RDS) as well as the
    // 3-tier EC2. The single traced flow may take the EKS branch (no EC2), but
    // the mission must still find ALB → EC2 → RDS structurally.
    const b = vpcThreeTier('security-hardening')
    const eks = N('eks-x', 'eks', 'vpc-1', {
      k8s_version: '1.31',
      node_instance_type: 't3.medium',
      ...withSg('sg-6'),
    })
    const nodes = [...b.nodes, eks]
    const edges = [
      E('albeks', 'alb-7', 'eks-x'), // fan-out branch, ordered before alb → ec2
      E('eksrds', 'eks-x', 'rds-9'),
      ...b.edges,
    ]
    expect(stars('security-hardening', nodes, edges, b.sg)).toBe(3)
  })

  it('tutorial recognizes a public Subnet nested via an AZ box (Account▸VPC▸AZ▸Subnet)', () => {
    // The subnet's DIRECT parent is the AZ box, not the VPC — the mission must
    // still count it by walking the parent chain to the enclosing VPC (ADR 0050).
    const nodes = [
      N('account-1', 'account', undefined, {}),
      N('vpc-1', 'vpc', 'account-1', { cidr_block: '10.0.0.0/16' }),
      N('az-1', 'az', 'vpc-1', { az: 'a' }),
      N('subnet-1', 'subnet', 'az-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    ]
    expect(stars('tutorial', nodes, [])).toBeGreaterThanOrEqual(2)
  })

  it('mission-scoped security ignores a disconnected insecure resource', () => {
    // A dangling public-block-off S3 unrelated to the async pipeline is ignored.
    const b = asyncBuild()
    const junk = N('s3-junk', 's3', undefined, { encryption: true, block_public_access: false }, 'Junk')
    expect(stars(b.id, [...b.nodes, junk], b.edges)).toBe(3)
  })
})

describe('Security Group assignment rules (ADR 0059, supersedes 0042)', () => {
  const assignable: ResourceType[] = ['ec2', 'alb', 'rds', 'ecs', 'eks', 'elasticache', 'efs']
  const notAssignable: ResourceType[] = ['lambda', 'nat', 'igw', 's3', 'dynamodb', 'cloudfront', 'route53', 'sqs', 'sns', 'vpc', 'subnet']

  it('marks exactly the VPC-bound ENI-owning resources as SG-assignable', () => {
    for (const t of assignable) expect(isSgAssignable(t), `${t} assignable`).toBe(true)
    for (const t of notAssignable) expect(isSgAssignable(t), `${t} not assignable`).toBe(false)
  })

  it('the "no SG" warning fires for exactly the assignable set (no contradiction)', () => {
    // Each resource that CAN be warned MUST be SG-assignable, and vice-versa.
    const vpc = N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' })
    const s1 = N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false })
    const s2 = N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false })
    const cases: [ResourceType, ResourceNodeType][] = [
      ['ec2', N('ec2-1', 'ec2', 'subnet-1', { instance_type: 't3.micro', ami: 'auto' })],
      ['alb', N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80 })],
      ['rds', N('rds-1', 'rds', 'subnet-1', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true })],
      ['ecs', N('ecs-1', 'ecs', 'vpc-1', { cpu: '256', desired_count: 1 })],
      ['eks', N('eks-1', 'eks', 'vpc-1', { k8s_version: '1.31', node_instance_type: 't3.medium' })],
      ['elasticache', N('cache-1', 'elasticache', 'subnet-1', { engine: 'redis', node_type: 'cache.t3.micro' })],
      ['efs', N('efs-1', 'efs', 'vpc-1', { encrypted: true, performance_mode: 'generalPurpose' })],
    ]
    for (const [t, node] of cases) {
      const issues = graphIssues([vpc, s1, s2, node], [], [])
      const warned = (issues.warnings.get(node.id) ?? []).some((w) => w.includes('Security Group'))
      expect(warned, `${t} should warn on missing SG`).toBe(true)
      expect(isSgAssignable(t), `${t} warned ⇒ assignable`).toBe(true)
    }
  })

  it('assigning an SG clears the ECS/EKS "no SG" warning', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
      N('ecs-3', 'ecs', 'vpc-1', { cpu: '256', desired_count: 1, ...withSg('sg-2') }),
      N('eks-4', 'eks', 'vpc-1', { k8s_version: '1.31', node_instance_type: 't3.medium', ...withSg('sg-2') }),
    ]
    const issues = graphIssues(nodes, [], [WEB_SG_2])
    expect((issues.warnings.get('ecs-3') ?? []).join()).not.toContain('Security Group')
    expect((issues.warnings.get('eks-4') ?? []).join()).not.toContain('Security Group')
  })
})
