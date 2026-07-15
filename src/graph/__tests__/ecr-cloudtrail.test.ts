import { describe, expect, it } from 'vitest'
import { generateTerraform } from '@/graph/terraform'
import { graphIssues } from '@/graph/checks'
import { simulate } from '@/graph/simulate'
import { canConnect } from '@/graph/rules'
import { resources } from '@/resources'
import { N, E } from './helpers'

describe('ECR + CloudTrail (ADR 0062)', () => {
  it('registers both resources with the right connection rules', () => {
    expect('ecr' in resources).toBe(true)
    expect('cloudtrail' in resources).toBe(true)
    expect(canConnect('ecr', 'ecs')).toBe(true)
    expect(canConnect('ecr', 'eks')).toBe(true)
    expect(canConnect('cloudtrail', 's3')).toBe(true)
    expect(canConnect('cloudtrail', 'ec2')).toBe(false)
  })

  it('emits an apply-ready ECR repository', () => {
    const main = generateTerraform(
      [N('ecr-1', 'ecr', undefined, { scan_on_push: true, image_tag_mutability: 'IMMUTABLE' })],
      [],
    )['main.tf']!
    expect(main).toContain('resource "aws_ecr_repository" "ecr_1"')
    expect(main).toContain('image_tag_mutability = "IMMUTABLE"')
    expect(main).toContain('scan_on_push = true')
    expect(main).not.toContain('REPLACE_ME')
  })

  it('emits CloudTrail with the derived S3 bucket policy it needs', () => {
    const nodes = [
      N('s3-1', 's3', undefined, { encryption: true, block_public_access: true }),
      N('trail-1', 'cloudtrail', undefined, { multi_region: true, log_file_validation: true }),
    ]
    const main = generateTerraform(nodes, [E('e', 'trail-1', 's3-1')])['main.tf']!
    expect(main).toContain('resource "aws_cloudtrail" "trail_1"')
    expect(main).toContain('s3_bucket_name                = aws_s3_bucket.s3_1.id')
    expect(main).toContain('is_multi_region_trail         = true')
    // Derived plumbing: the bucket policy granting the CloudTrail service.
    expect(main).toContain('resource "aws_s3_bucket_policy" "trail_1_bucket_policy"')
    expect(main).toContain('cloudtrail.amazonaws.com')
    expect(main).toContain('data "aws_caller_identity" "trail_1_current"')
    expect(main).not.toContain('REPLACE_ME')
  })

  it('warns when the audit/registry targets are missing', () => {
    const issues = graphIssues(
      [N('ecr-1', 'ecr', undefined, {}), N('trail-1', 'cloudtrail', undefined, {})],
      [],
    )
    expect(issues.warnings.get('ecr-1')?.join()).toContain('컨테이너')
    expect(issues.warnings.get('trail-1')?.join()).toContain('S3')
  })

  it('excludes ECR/CloudTrail edges from the traffic simulation', () => {
    // ECR → ECS (image pull) and CloudTrail → S3 (log delivery) are not request
    // traffic, so neither starts a flow nor lights up the target.
    const nodes = [
      N('ecr-1', 'ecr', undefined, {}),
      N('ecs-1', 'ecs', undefined, {}),
      N('trail-1', 'cloudtrail', undefined, {}),
      N('s3-1', 's3', undefined, {}),
    ]
    const sim = simulate(nodes, [E('e1', 'ecr-1', 'ecs-1'), E('e2', 'trail-1', 's3-1')])
    // Neither edge carries request traffic, so neither is ever lit.
    expect(sim.pathEdgeIds).not.toContain('e1')
    expect(sim.pathEdgeIds).not.toContain('e2')
  })
})
