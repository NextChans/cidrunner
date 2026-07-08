import { describe, expect, it } from 'vitest'
import { simulate } from '@/graph/simulate'
import { graphIssues } from '@/graph/checks'
import { generateTerraform } from '@/graph/terraform'
import { canConnect } from '@/graph/rules'
import { getMission } from '@/missions'
import { E, N } from './helpers'

/** Route 53 → CloudFront → S3 static-site pattern. */
function staticSite() {
  const nodes = [
    N('route53-1', 'route53', undefined, { domain_name: 'example.com' }, 'DNS'),
    N('cloudfront-2', 'cloudfront', undefined, { price_class: 'PriceClass_200' }, 'CDN'),
    N('s3-3', 's3', undefined, { versioning: false, encryption: true, block_public_access: true }, 'Site'),
  ]
  const edges = [E('e1', 'route53-1', 'cloudfront-2'), E('e2', 'cloudfront-2', 's3-3')]
  return { nodes, edges }
}

/** Lambda → SQS → Lambda → DynamoDB async pipeline. */
function pipeline() {
  const nodes = [
    N('lambda-1', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }, 'API'),
    N('sqs-2', 'sqs', undefined, { fifo: false, visibility_timeout: 30 }, 'Jobs'),
    N('lambda-3', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }, 'Worker'),
    N('dynamodb-4', 'dynamodb', undefined, { billing_mode: 'PAY_PER_REQUEST', hash_key: 'id' }, 'Results'),
  ]
  const edges = [E('e1', 'lambda-1', 'sqs-2'), E('e2', 'sqs-2', 'lambda-3'), E('e3', 'lambda-3', 'dynamodb-4')]
  return { nodes, edges }
}

describe('resource expansion (ADR 0022)', () => {
  it('extends edge rules for the new blocks', () => {
    expect(canConnect('route53', 'cloudfront')).toBe(true)
    expect(canConnect('cloudfront', 's3')).toBe(true)
    expect(canConnect('cloudfront', 'alb')).toBe(true)
    expect(canConnect('sqs', 'lambda')).toBe(true)
    expect(canConnect('lambda', 'sqs')).toBe(true)
    expect(canConnect('ec2', 'dynamodb')).toBe(true)
    expect(canConnect('s3', 'cloudfront')).toBe(false)
    expect(canConnect('sqs', 'ec2')).toBe(false)
  })

  it('simulates R53 → CF → S3 as one flow (CF-fed nodes are not entries)', () => {
    const { nodes, edges } = staticSite()
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0].pathNodeIds).toEqual(['route53-1', 'cloudfront-2', 's3-3'])
  })

  it('simulates the async pipeline; a queue-fed lambda is not its own entry', () => {
    const { nodes, edges } = pipeline()
    const sim = simulate(nodes, edges)
    expect(sim.ok).toBe(true)
    expect(sim.flows).toHaveLength(1)
    expect(sim.flows[0].pathNodeIds).toEqual(['lambda-1', 'sqs-2', 'lambda-3', 'dynamodb-4'])
  })

  it('blocks at an SQS with no consumer and at a CloudFront with no origin', () => {
    const noConsumer = simulate(
      [N('lambda-1', 'lambda'), N('sqs-2', 'sqs')],
      [E('e1', 'lambda-1', 'sqs-2')],
    )
    expect(noConsumer.ok).toBe(false)
    expect(noConsumer.flows[0].blockedNodeId).toBe('sqs-2')

    const noOrigin = simulate([N('cloudfront-1', 'cloudfront')], [])
    expect(noOrigin.ok).toBe(false)
    expect(noOrigin.flows[0].blockedNodeId).toBe('cloudfront-1')
  })

  it('checks: CF without origin is an error; R53/SQS dangling are warnings', () => {
    const issues = graphIssues(
      [N('cloudfront-1', 'cloudfront'), N('route53-2', 'route53', undefined, { domain_name: 'example.com' }), N('sqs-3', 'sqs')],
      [],
    )
    expect(issues.errors.get('cloudfront-1')?.join()).toContain('오리진')
    expect(issues.warnings.get('route53-2')?.join()).toContain('대상')
    expect(issues.warnings.get('sqs-3')?.join()).toContain('Lambda')
  })

  it('emits Terraform for the static-site pattern (OAI + alias record)', () => {
    const { nodes, edges } = staticSite()
    const main = generateTerraform(nodes, edges)['main.tf']
    expect(main).toContain('resource "aws_cloudfront_origin_access_identity" "cloudfront_2_oai"')
    expect(main).toContain('s3_origin_config')
    expect(main).toContain('resource "aws_route53_zone" "route53_1"')
    expect(main).toContain('alias {')
    expect(main).toContain('aws_cloudfront_distribution.cloudfront_2.domain_name')
    expect((main.match(/{/g) ?? []).length).toBe((main.match(/}/g) ?? []).length)
  })

  it('emits Terraform for the pipeline (event source mapping + SQS role policy)', () => {
    const { nodes, edges } = pipeline()
    const main = generateTerraform(nodes, edges)['main.tf']
    expect(main).toContain('resource "aws_sqs_queue" "sqs_2"')
    expect(main).toContain('resource "aws_lambda_event_source_mapping" "sqs_2_lambda_3"')
    expect(main).toContain('resource "aws_dynamodb_table" "dynamodb_4"')
    // Only the queue-fed worker gets the SQS execution policy.
    expect(main).toContain('"lambda_3_sqs"')
    expect(main).not.toContain('"lambda_1_sqs"')
  })

  it('clears the two new missions at three stars on clean builds', () => {
    const s = staticSite()
    const sSim = simulate(s.nodes, s.edges)
    const sIssues = graphIssues(s.nodes, s.edges)
    const sCtx = { ...s, sim: sSim, allValid: true, securityOk: true, issues: sIssues }
    expect(getMission('static-cdn')!.check!(sCtx)).toBe(3)

    const p = pipeline()
    const pSim = simulate(p.nodes, p.edges)
    const pIssues = graphIssues(p.nodes, p.edges)
    const pCtx = { ...p, sim: pSim, allValid: true, securityOk: true, issues: pIssues }
    expect(getMission('async-pipeline')!.check!(pCtx)).toBe(3)
    // Not cleared without the queue hop.
    const direct = {
      nodes: p.nodes,
      edges: [E('e1', 'lambda-1', 'dynamodb-4')],
    }
    const dSim = simulate(direct.nodes, direct.edges)
    const dCtx = { ...direct, sim: dSim, allValid: true, securityOk: true, issues: pIssues }
    expect(getMission('async-pipeline')!.check!(dCtx)).toBe(0)
  })
})
