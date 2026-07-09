import { describe, expect, it } from 'vitest'
import { generateTerraform } from '@/graph/terraform'
import { bestPracticeTopology, E, N } from './helpers'

describe('generateTerraform', () => {
  it('emits every expected resource for the best-practice topology', () => {
    const { nodes, edges } = bestPracticeTopology()
    const files = generateTerraform(nodes, edges)
    const main = files['main.tf']!

    // Derived plumbing (ADR 0016).
    expect(main).toContain('resource "aws_route_table" "vpc_1_public"')
    expect(main).toContain('resource "aws_route_table" "vpc_1_private"')
    expect(main).toContain('nat_gateway_id = aws_nat_gateway.nat_6.id')
    expect(main).toContain('resource "aws_db_subnet_group" "vpc_1_dbsg"')
    expect(main).toContain('data "aws_ami" "al2023"')
    expect(main).toContain('resource "aws_iam_role" "lambda_12_role"')
    expect(main).toContain('resource "aws_lambda_function" "lambda_12"')
    // The Lambda no longer bundles an API Gateway (ADR 0046).
    expect(main).not.toContain('aws_apigatewayv2_api')

    // Edge-driven wiring.
    expect(main).toContain('resource "aws_lb_target_group_attachment" "alb_8_ec2_9"')
    expect(main).toMatch(/security_groups\s+= \[aws_security_group\.sg_7\.id\]/)
    expect(main).toContain('vpc_security_group_ids = [aws_security_group.sg_7.id]')

    // Sensitive variable and outputs.
    expect(files['variables.tf']).toContain('variable "db_password"')
    expect(files['variables.tf']).not.toContain('default   = "ChangeMe')
    expect(files['outputs.tf']).toContain('output "alb_8_dns_name"')
    expect(files['outputs.tf']).toContain('output "lambda_12_function_arn"')

    // Braces balance — a cheap structural sanity check.
    const all = main + (files['variables.tf'] ?? '') + (files['outputs.tf'] ?? '')
    expect((all.match(/{/g) ?? []).length).toBe((all.match(/}/g) ?? []).length)
    expect(all).not.toContain('REPLACE_ME')
  })

  it('emits a read replica with replicate_source_db and no inherited attributes', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: false }),
      N('rds-1', 'rds', 's1', { engine: 'mysql', instance_class: 'db.t3.micro' }, 'Primary'),
      N('rds-2', 'rds', 's2', { engine: 'mysql', instance_class: 'db.t3.micro' }, 'Replica'),
    ]
    const files = generateTerraform(nodes, [E('r1', 'rds-1', 'rds-2')])
    const main = files['main.tf']!

    const replicaBlock = main.split('resource "aws_db_instance" "rds_2"')[1]?.split('\n}')[0] ?? ''
    expect(replicaBlock).toContain('replicate_source_db = aws_db_instance.rds_1.identifier')
    expect(replicaBlock).not.toContain('password')
    expect(replicaBlock).not.toContain('engine')
    expect(replicaBlock).not.toContain('db_subnet_group_name')

    const primaryBlock = main.split('resource "aws_db_instance" "rds_1"')[1]?.split('\n}')[0] ?? ''
    expect(primaryBlock).toContain('password            = var.db_password')
  })

  it('honours a hand-set AMI and skips the lookup when unused', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('ec2-1', 'ec2', 's1', { instance_type: 't3.micro', ami: 'ami-0123456789abcdef0' }),
    ]
    const main = generateTerraform(nodes, [])['main.tf']
    expect(main).toContain('ami           = "ami-0123456789abcdef0"')
    expect(main).not.toContain('data "aws_ami"')
  })

  it('emits a REST API wired to its connected Lambda (ADR 0046)', () => {
    const nodes = [
      N('apigw-1', 'apigw', undefined, { stage_name: 'prod', endpoint_type: 'regional' }, 'Public API'),
      N('lambda-2', 'lambda', undefined, { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 128 }, 'Fn'),
      N('s3-3', 's3', undefined, { versioning: true, encryption: true, block_public_access: true }),
    ]
    const files = generateTerraform(nodes, [E('t0', 'apigw-1', 'lambda-2'), E('t1', 'lambda-2', 's3-3')])
    const main = files['main.tf']!

    // Six REST API blocks + invoke permission, all wired to the Lambda.
    expect(main).toContain('resource "aws_api_gateway_rest_api" "apigw_1"')
    expect(main).toContain('resource "aws_api_gateway_resource" "apigw_1_proxy"')
    expect(main).toContain('resource "aws_api_gateway_method" "apigw_1_proxy"')
    expect(main).toContain('resource "aws_api_gateway_integration" "apigw_1_lambda"')
    expect(main).toContain('resource "aws_api_gateway_deployment" "apigw_1"')
    expect(main).toContain('resource "aws_api_gateway_stage" "apigw_1"')
    expect(main).toContain('resource "aws_lambda_permission" "apigw_1_invoke"')
    expect(main).toContain('uri                     = aws_lambda_function.lambda_2.invoke_arn')
    expect(main).toContain('stage_name    = "prod"')
    expect(files['outputs.tf']).toContain('output "apigw_1_invoke_url"')

    // No dangling markers for a fully-connected API.
    expect(main).not.toContain('REPLACE_ME')

    const all = main + (files['variables.tf'] ?? '') + (files['outputs.tf'] ?? '')
    expect((all.match(/{/g) ?? []).length).toBe((all.match(/}/g) ?? []).length)
  })

  it('marks the gap when an API Gateway has no Lambda connected', () => {
    const files = generateTerraform(
      [N('apigw-1', 'apigw', undefined, { stage_name: 'prod', endpoint_type: 'regional' })],
      [],
    )
    const main = files['main.tf']!
    expect(main).toContain('resource "aws_api_gateway_rest_api" "apigw_1"')
    expect(main).toContain('REPLACE_ME')
    // No invoke permission when there is no function to grant it on.
    expect(main).not.toContain('aws_lambda_permission')
  })

  it('omits rds-only artifacts when the graph has no primary RDS', () => {
    const files = generateTerraform(
      [N('s3-1', 's3', undefined, { versioning: false, encryption: true, block_public_access: true })],
      [],
    )
    expect(files['variables.tf']).not.toContain('db_password')
    expect(files['main.tf']).not.toContain('aws_db_subnet_group')
  })
})
