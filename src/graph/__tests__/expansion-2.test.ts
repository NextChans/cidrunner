import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import { generateTerraform } from '@/graph/terraform'
import { canConnect } from '@/graph/rules'
import { getMission } from '@/missions'
import { getResource } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'
import type { MissionCheckContext } from '@/missions/types'
import { E, N } from './helpers'

/** Builds a live mission-check context exactly as the MissionPanel does. */
function ctxFor(nodes: ResourceNodeType[], edges: Edge[]): MissionCheckContext {
  const issues = graphIssues(nodes, edges)
  const allValid = nodes.every(
    (n) =>
      (getResource(n.data.type).validate?.(n.data.config) ?? []).length === 0 &&
      (issues.errors.get(n.id)?.length ?? 0) === 0,
  )
  const securityOk = nodes.every((n) => (issues.warnings.get(n.id)?.length ?? 0) === 0)
  return { nodes, edges, sim: simulate(nodes, edges), allValid, securityOk, issues }
}

/** ALB → ECS → RDS container workload (best-practice, secure). */
function containerTopology() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }, 'Prod VPC'),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }, 'Pub A'),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }, 'Pub B'),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }, 'Priv A'),
    N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }, 'Priv B'),
    N('igw-5', 'igw', 'vpc-1', {}, 'IGW'),
    N('sg-6', 'sg', 'vpc-1', { allow_http: true, allow_https: true, allow_ssh: false }, 'Web SG'),
    N('alb-7', 'alb', 'vpc-1', { internal: false, listener_port: 80 }, 'Web ALB'),
    N('ecs-8', 'ecs', 'vpc-1', { cpu: '512', desired_count: 2 }, 'App Service'),
    N(
      'rds-9',
      'rds',
      'subnet-4',
      { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true },
      'App DB',
    ),
  ]
  const edges = [
    E('a1', 'sg-6', 'alb-7'),
    E('a2', 'sg-6', 'ecs-8'),
    E('a3', 'sg-6', 'rds-9'),
    E('t1', 'alb-7', 'ecs-8'),
    E('t2', 'ecs-8', 'rds-9'),
  ]
  return { nodes, edges }
}

/** Lambda → SNS → SQS → Lambda → DynamoDB event-driven fan-out. */
function eventTopology() {
  const nodes = [
    N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }, 'Producer'),
    N('sns-2', 'sns', undefined, { display_name: '' }, 'Events'),
    N('sqs-3', 'sqs', undefined, { fifo: false, visibility_timeout: 30 }, 'Jobs'),
    N('lambda-4', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }, 'Worker'),
    N('dynamodb-5', 'dynamodb', undefined, { billing_mode: 'PAY_PER_REQUEST', hash_key: 'id' }, 'Results'),
  ]
  const edges = [
    E('e1', 'lambda-1', 'sns-2'),
    E('e2', 'sns-2', 'sqs-3'),
    E('e3', 'sqs-3', 'lambda-4'),
    E('e4', 'lambda-4', 'dynamodb-5'),
  ]
  return { nodes, edges }
}

/** Route 53 → CloudFront → ALB → EC2 → RDS dynamic global web. */
function globalWebTopology() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
    N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.4.0/24', az: 'b', public: false }),
    N('igw-5', 'igw', 'vpc-1', {}),
    N('sg-6', 'sg', 'vpc-1', { allow_http: true, allow_https: true, allow_ssh: false }),
    N('alb-7', 'alb', 'vpc-1', { internal: false, listener_port: 80 }),
    N('ec2-8', 'ec2', 'subnet-3', { instance_type: 't3.micro', ami: 'auto' }),
    N('rds-9', 'rds', 'subnet-4', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true }),
    N('cloudfront-10', 'cloudfront', undefined, { price_class: 'PriceClass_200' }),
    N('route53-11', 'route53', undefined, { domain_name: 'example.com' }),
  ]
  const edges = [
    E('a1', 'sg-6', 'alb-7'),
    E('a2', 'sg-6', 'ec2-8'),
    E('a3', 'sg-6', 'rds-9'),
    E('t1', 'alb-7', 'ec2-8'),
    E('t2', 'ec2-8', 'rds-9'),
    E('o1', 'cloudfront-10', 'alb-7'),
    E('d1', 'route53-11', 'cloudfront-10'),
  ]
  return { nodes, edges }
}

/** Multi-AZ RDS + cross-AZ read replica for disaster recovery. */
function drTopology() {
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
    N('rds-3', 'rds', 'subnet-1', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, multi_az: true, storage_encrypted: true }, 'Primary'),
    N('rds-4', 'rds', 'subnet-2', { engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, storage_encrypted: true }, 'Replica'),
  ]
  const edges = [E('r1', 'rds-3', 'rds-4')]
  return { nodes, edges }
}

describe('resource expansion batch 2 (ADR 0026)', () => {
  it('extends edge rules for the new blocks', () => {
    expect(canConnect('alb', 'ecs')).toBe(true)
    expect(canConnect('alb', 'eks')).toBe(true)
    expect(canConnect('ecs', 'rds')).toBe(true)
    expect(canConnect('eks', 'elasticache')).toBe(true)
    expect(canConnect('lambda', 'sns')).toBe(true)
    expect(canConnect('sns', 'sqs')).toBe(true)
    expect(canConnect('sns', 'lambda')).toBe(true)
    expect(canConnect('ec2', 'efs')).toBe(true)
    expect(canConnect('cloudwatch', 'rds')).toBe(true)
    // Not allowed.
    expect(canConnect('efs', 'ec2')).toBe(false)
    expect(canConnect('sns', 'ec2')).toBe(false)
    expect(canConnect('cloudwatch', 's3')).toBe(false)
  })

  it('treats cache and file system as request sinks', () => {
    // Lambda is an entry; a cache terminates the request like a database.
    const cache = simulate(
      [N('lambda-1', 'lambda'), N('cache-2', 'elasticache')],
      [E('t', 'lambda-1', 'cache-2')],
    )
    expect(cache.ok).toBe(true)
    expect(cache.flows[0]!.pathNodeIds).toEqual(['lambda-1', 'cache-2'])

    // EFS is reached by an EC2 behind an ALB (only EC2 mounts a file system).
    const file = simulate(
      [N('alb-1', 'alb'), N('ec2-2', 'ec2'), N('efs-3', 'efs')],
      [E('t1', 'alb-1', 'ec2-2'), E('t2', 'ec2-2', 'efs-3')],
    )
    expect(file.ok).toBe(true)
    expect(file.flows[0]!.pathNodeIds).toEqual(['alb-1', 'ec2-2', 'efs-3'])
  })

  it('ignores CloudWatch monitoring edges as traffic', () => {
    // A CloudWatch edge into an ALB must not disqualify the ALB as an entry.
    const sim = simulate(
      [N('cw-1', 'cloudwatch'), N('alb-2', 'alb'), N('ec2-3', 'ec2'), N('rds-4', 'rds')],
      [E('m', 'cw-1', 'alb-2'), E('t1', 'alb-2', 'ec2-3'), E('t2', 'ec2-3', 'rds-4')],
    )
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0]!.pathNodeIds).toEqual(['alb-2', 'ec2-3', 'rds-4'])
  })

  it('simulates ALB → ECS → RDS as one container flow', () => {
    const { nodes, edges } = containerTopology()
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0]!.pathNodeIds).toEqual(['alb-7', 'ecs-8', 'rds-9'])
  })

  it('simulates the SNS fan-out as one flow (a subscribed lambda is not an entry)', () => {
    const { nodes, edges } = eventTopology()
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0]!.pathNodeIds).toEqual(['lambda-1', 'sns-2', 'sqs-3', 'lambda-4', 'dynamodb-5'])
  })

  it('checks: ElastiCache/EKS single-AZ are errors; SNS/EFS/CloudWatch dangling are warnings', () => {
    const cacheIssues = graphIssues(
      [
        N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
        N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
        N('cache-2', 'elasticache', 'subnet-1', { engine: 'redis', node_type: 'cache.t3.micro' }),
      ],
      [],
    )
    expect(cacheIssues.errors.get('cache-2')?.join()).toContain('AZ')

    const misc = graphIssues(
      [
        N('sns-1', 'sns', undefined, { display_name: '' }),
        N('efs-1', 'efs', undefined, { encrypted: false }),
        N('cw-1', 'cloudwatch', undefined, { retention_days: 30, threshold: 80 }),
      ],
      [],
    )
    expect(misc.warnings.get('sns-1')?.join()).toContain('구독')
    expect(misc.warnings.get('efs-1')?.join()).toContain('암호화')
    expect(misc.warnings.get('cw-1')?.join()).toContain('모니터링')
  })

  it('emits apply-ready Terraform for a container topology (ECS Fargate)', () => {
    const { nodes, edges } = containerTopology()
    const main = generateTerraform(nodes, edges)['main.tf']!
    expect(main).toContain('resource "aws_ecs_cluster" "ecs_8"')
    expect(main).toContain('resource "aws_ecs_task_definition" "ecs_8_task"')
    expect(main).toContain('resource "aws_ecs_service" "ecs_8_svc"')
    expect(main).toContain('AmazonECSTaskExecutionRolePolicy')
    expect(main).toContain('public.ecr.aws/nginx/nginx:stable')
    // Fargate cpu/memory pair honoured.
    expect(main).toContain('cpu                      = "512"')
    expect(main).toContain('memory                   = "1024"')
    expect((main.match(/{/g) ?? []).length).toBe((main.match(/}/g) ?? []).length)
    expect(main).not.toContain('REPLACE_ME')
  })

  it('emits a self-contained EKS cluster + managed node group', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
      N('eks-3', 'eks', 'vpc-1', { k8s_version: '1.31', node_instance_type: 't3.medium' }),
    ]
    const main = generateTerraform(nodes, [])['main.tf']!
    expect(main).toContain('resource "aws_eks_cluster" "eks_3"')
    expect(main).toContain('resource "aws_eks_node_group" "eks_3_nodes"')
    expect(main).toContain('AmazonEKSClusterPolicy')
    expect(main).toContain('AmazonEKS_CNI_Policy')
    expect(main).toContain('version  = "1.31"')
    expect((main.match(/{/g) ?? []).length).toBe((main.match(/}/g) ?? []).length)
    expect(main).not.toContain('REPLACE_ME')
  })

  it('emits ElastiCache with a per-VPC cache subnet group', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
      N('cache-3', 'elasticache', 'subnet-1', { engine: 'redis', node_type: 'cache.t3.micro' }),
    ]
    const files = generateTerraform(nodes, [])
    const main = files['main.tf']!
    expect(main).toContain('resource "aws_elasticache_cluster" "cache_3"')
    expect(main).toContain('engine               = "redis"')
    expect(main).toContain('resource "aws_elasticache_subnet_group" "vpc_1_cachesg"')
    expect(main).toContain('subnet_group_name    = aws_elasticache_subnet_group.vpc_1_cachesg.name')
    expect(files['outputs.tf']).toContain('output "cache_3_cache_address"')
  })

  it('emits EFS with one mount target per distinct AZ', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
      N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.3.0/24', az: 'a', public: false }),
      N('efs-4', 'efs', 'vpc-1', { encrypted: true, performance_mode: 'generalPurpose' }),
    ]
    const main = generateTerraform(nodes, [])['main.tf']!
    expect(main).toContain('resource "aws_efs_file_system" "efs_4"')
    // 3 subnets but only 2 AZs → exactly 2 mount targets.
    expect((main.match(/resource "aws_efs_mount_target"/g) ?? []).length).toBe(2)
    expect(main).toContain('encrypted        = true')
  })

  it('emits SNS subscriptions with the delivery permission each endpoint needs', () => {
    const { nodes, edges } = eventTopology()
    const main = generateTerraform(nodes, edges)['main.tf']!
    expect(main).toContain('resource "aws_sns_topic" "sns_2"')
    expect(main).toContain('resource "aws_sns_topic_subscription" "sns_2_sqs_3"')
    expect(main).toContain('protocol  = "sqs"')
    expect(main).toContain('resource "aws_sqs_queue_policy" "sns_2_sqs_3_policy"')

    // A direct sns → lambda subscription emits an invoke permission instead.
    const lambdaSub = generateTerraform(
      [N('sns-1', 'sns', undefined, { display_name: '' }), N('lambda-2', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 })],
      [E('s', 'sns-1', 'lambda-2')],
    )['main.tf']!
    expect(lambdaSub).toContain('protocol  = "lambda"')
    expect(lambdaSub).toContain('resource "aws_lambda_permission" "sns_1_lambda_2_sns"')
    expect(lambdaSub).toContain('principal     = "sns.amazonaws.com"')
  })

  it('emits a CloudWatch log group plus a scoped metric alarm per target', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('ec2-2', 'ec2', 'subnet-1', { instance_type: 't3.micro', ami: 'auto' }),
      N('cw-3', 'cloudwatch', undefined, { retention_days: 14, threshold: 75 }),
    ]
    const main = generateTerraform(nodes, [E('m', 'cw-3', 'ec2-2')])['main.tf']!
    expect(main).toContain('resource "aws_cloudwatch_log_group" "cw_3"')
    expect(main).toContain('retention_in_days = 14')
    expect(main).toContain('resource "aws_cloudwatch_metric_alarm" "cw_3_ec2_2"')
    expect(main).toContain('namespace           = "AWS/EC2"')
    expect(main).toContain('InstanceId = aws_instance.ec2_2.id')
    expect(main).toContain('threshold           = 75')
  })

  it('clears all four new missions at three stars on clean builds', () => {
    const c = containerTopology()
    expect(getMission('container-workload')!.check!(ctxFor(c.nodes, c.edges))).toBe(3)
    const ev = eventTopology()
    expect(getMission('event-driven')!.check!(ctxFor(ev.nodes, ev.edges))).toBe(3)
    const gw = globalWebTopology()
    expect(getMission('global-web')!.check!(ctxFor(gw.nodes, gw.edges))).toBe(3)
    const dr = drTopology()
    expect(getMission('disaster-recovery')!.check!(ctxFor(dr.nodes, dr.edges))).toBe(3)
  })

  it('does not clear the container mission without the container hop', () => {
    const { nodes } = containerTopology()
    // ALB straight to RDS (no ECS on the path) — not a container workload.
    const edges = [E('t', 'alb-7', 'ecs-8'), E('bad', 'alb-7', 'rds-9')]
    // Remove the ecs→rds hop so the flow can't pass through the container.
    const noHop = edges.filter((e) => e.id !== 't')
    expect(getMission('container-workload')!.check!(ctxFor(nodes, noHop))).toBe(0)
  })

  it('does not clear disaster recovery below three stars when the replica shares the AZ', () => {
    const { nodes, edges } = drTopology()
    // Move the replica into the primary's AZ (both AZ a).
    const sameAz = nodes.map((n) =>
      n.id === 'subnet-2' ? { ...n, data: { ...n.data, config: { ...n.data.config, az: 'a' } } } : n,
    )
    const stars = getMission('disaster-recovery')!.check!(ctxFor(sameAz, edges))
    expect(stars).toBeGreaterThanOrEqual(1)
    expect(stars).toBeLessThan(3)
  })
})
