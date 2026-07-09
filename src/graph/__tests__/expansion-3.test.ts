import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import { generateTerraform } from '@/graph/terraform'
import { canBeSource, canConnect } from '@/graph/rules'
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

/** Kinesis → Lambda → S3 real-time ingestion pipeline. */
function pipelineTopology() {
  const nodes = [
    N('kinesis-1', 'kinesis', undefined, { mode: 'ON_DEMAND', shard_count: 1, retention_hours: 24 }, 'Ingest'),
    N('lambda-2', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }, 'Processor'),
    N('s3-3', 's3', undefined, { versioning: true, encryption: true, block_public_access: true }, 'Raw'),
  ]
  const edges = [E('t1', 'kinesis-1', 'lambda-2'), E('t2', 'lambda-2', 's3-3')]
  return { nodes, edges }
}

/** CloudFront → ALB → EC2 → RDS with the full auth/security stack. */
function secureAuthTopology() {
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
    N('cognito-11', 'cognito', undefined, { mfa: 'OPTIONAL', password_min_length: 12, email_verification: true }),
    N('secrets-12', 'secretsmanager', undefined, { recovery_window_days: 30 }),
    N('kms-13', 'kms', undefined, { enable_key_rotation: true, deletion_window_days: 30 }),
    N('acm-14', 'acm', undefined, { domain_name: 'example.com', validation_method: 'DNS' }),
    N('waf-15', 'waf', undefined, { rate_limit: 2000, managed_common_rules: true }),
  ]
  const edges = [
    E('a1', 'sg-6', 'alb-7'),
    E('a2', 'sg-6', 'ec2-8'),
    E('a3', 'sg-6', 'rds-9'),
    E('o1', 'cloudfront-10', 'alb-7'),
    E('t1', 'alb-7', 'ec2-8'),
    E('t2', 'ec2-8', 'rds-9'),
    E('k1', 'secrets-12', 'kms-13'),
  ]
  return { nodes, edges }
}

describe('resource expansion batch 3 (ADR 0035)', () => {
  it('extends edge rules for the streaming + secrets blocks', () => {
    expect(canConnect('kinesis', 'lambda')).toBe(true)
    expect(canConnect('secretsmanager', 'kms')).toBe(true)
    // Standalone identity/security blocks originate no edges.
    expect(canBeSource('cognito')).toBe(false)
    expect(canBeSource('acm')).toBe(false)
    expect(canBeSource('waf')).toBe(false)
    expect(canBeSource('kms')).toBe(false)
    // Not allowed.
    expect(canConnect('kinesis', 's3')).toBe(false)
    expect(canConnect('kms', 'secretsmanager')).toBe(false)
  })

  it('traces Kinesis → Lambda → S3 with Kinesis as the pipeline entry', () => {
    const { nodes, edges } = pipelineTopology()
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0]!.pathNodeIds).toEqual(['kinesis-1', 'lambda-2', 's3-3'])
  })

  it('blocks at a Kinesis stream with no Lambda consumer', () => {
    const sim = simulate([N('kinesis-1', 'kinesis')], [])
    expect(sim.ok).toBe(false)
    expect(sim.flows[0]!.blockedNodeId).toBe('kinesis-1')
    expect(sim.flows[0]!.message).toContain('Lambda')
  })

  it('warns on a dangling Kinesis and validates Cognito/KMS ranges', () => {
    const issues = graphIssues([N('kinesis-1', 'kinesis', undefined, {})], [])
    expect(issues.warnings.get('kinesis-1')?.join()).toContain('Lambda')

    expect(getResource('cognito').validate!({ password_min_length: 4 })).toHaveLength(1)
    expect(getResource('cognito').validate!({ password_min_length: 8 })).toHaveLength(0)
    expect(getResource('kms').validate!({ deletion_window_days: 3 })).toHaveLength(1)
    expect(getResource('acm').validate!({ domain_name: 'not a domain' })).toHaveLength(1)
    expect(getResource('acm').validate!({ domain_name: 'example.com' })).toHaveLength(0)
    expect(getResource('waf').validate!({ rate_limit: 50 })).toHaveLength(1)
  })

  it('emits apply-ready Terraform for the streaming pipeline', () => {
    const { nodes, edges } = pipelineTopology()
    const files = generateTerraform(nodes, edges)
    const main = files['main.tf']!
    expect(main).toContain('resource "aws_kinesis_stream" "kinesis_1"')
    expect(main).toContain('stream_mode = "ON_DEMAND"')
    expect(main).toContain('resource "aws_lambda_event_source_mapping" "kinesis_1_lambda_2"')
    expect(main).toContain('AWSLambdaKinesisExecutionRole')
    expect(main).toContain('starting_position = "LATEST"')
    expect(files['outputs.tf']).toContain('output "kinesis_1_stream_arn"')
    expect((main.match(/{/g) ?? []).length).toBe((main.match(/}/g) ?? []).length)
    expect(main).not.toContain('REPLACE_ME')
  })

  it('emits a provisioned Kinesis stream with an explicit shard count', () => {
    const main = generateTerraform(
      [N('kinesis-1', 'kinesis', undefined, { mode: 'PROVISIONED', shard_count: 4, retention_hours: 48 })],
      [],
    )['main.tf']!
    expect(main).toContain('shard_count = 4')
    expect(main).toContain('retention_period = 48')
    expect(main).not.toContain('stream_mode')
  })

  it('emits the security/identity stack and wires Secrets Manager to KMS', () => {
    const { nodes, edges } = secureAuthTopology()
    const files = generateTerraform(nodes, edges)
    const main = files['main.tf']!
    expect(main).toContain('resource "aws_cognito_user_pool" "cognito_11"')
    expect(main).toContain('resource "aws_cognito_user_pool_client" "cognito_11_client"')
    expect(main).toContain('mfa_configuration = "OPTIONAL"')
    expect(main).toContain('software_token_mfa_configuration')
    expect(main).toContain('resource "aws_kms_key" "kms_13"')
    expect(main).toContain('resource "aws_kms_alias" "kms_13_alias"')
    expect(main).toContain('resource "aws_secretsmanager_secret" "secrets_12"')
    // The secretsmanager → kms edge points the secret at the customer key.
    expect(main).toContain('kms_key_id              = aws_kms_key.kms_13.arn')
    expect(main).toContain('resource "aws_acm_certificate" "acm_14"')
    expect(main).toContain('validation_method = "DNS"')
    expect(main).toContain('resource "aws_wafv2_web_acl" "waf_15"')
    expect(main).toContain('AWSManagedRulesCommonRuleSet')
    expect(main).toContain('rate_based_statement')
    expect((main.match(/{/g) ?? []).length).toBe((main.match(/}/g) ?? []).length)
    expect(main).not.toContain('REPLACE_ME')
  })

  it('omits the KMS reference when Secrets Manager has no key edge', () => {
    const main = generateTerraform(
      [N('secrets-1', 'secretsmanager', undefined, { recovery_window_days: 7 })],
      [],
    )['main.tf']!
    expect(main).toContain('resource "aws_secretsmanager_secret" "secrets_1"')
    expect(main).not.toContain('kms_key_id')
    expect(main).toContain('recovery_window_in_days = 7')
  })

  it('clears both new missions at three stars on clean builds', () => {
    const p = pipelineTopology()
    expect(getMission('data-pipeline')!.check!(ctxFor(p.nodes, p.edges))).toBe(3)
    const s = secureAuthTopology()
    expect(getMission('secure-auth-web')!.check!(ctxFor(s.nodes, s.edges))).toBe(3)
  })

  it('does not clear the auth mission when the security stack is incomplete', () => {
    const { nodes, edges } = secureAuthTopology()
    // Drop the WAF block — the traffic path still works but the stack is short.
    const noWaf = nodes.filter((n) => n.id !== 'waf-15')
    expect(getMission('secure-auth-web')!.check!(ctxFor(noWaf, edges))).toBe(0)
  })

  it('does not clear the pipeline mission without the Lambda hop', () => {
    const { nodes } = pipelineTopology()
    // Kinesis straight to S3 is not a valid edge, so there is no processing hop.
    const direct: Edge[] = [E('t', 'kinesis-1', 's3-3')]
    expect(getMission('data-pipeline')!.check!(ctxFor(nodes, direct))).toBe(0)
  })
})
