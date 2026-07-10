import { describe, expect, it } from 'vitest'
import { generateTerraform } from '@/graph/terraform'
import { bestPracticeTopology, N } from './helpers'

/**
 * Apply-readiness invariants (Sprint A / ADR 0025). These pin down the audit
 * conclusions so a future refactor can't silently regress apply-safety:
 *   - the region is a variable (no hard-coded region),
 *   - secrets are variables with no default,
 *   - an orphaned resource emits a LOUD, non-appliable marker rather than a
 *     silently-broken reference.
 */
describe('terraform apply-readiness (ADR 0025)', () => {
  it('parameterizes the region and never hard-codes it in the provider', () => {
    const { nodes, edges, securityGroups } = bestPracticeTopology()
    const files = generateTerraform(nodes, edges, securityGroups)
    expect(files['variables.tf']).toContain('variable "aws_region"')
    expect(files['variables.tf']).toContain('default     = "ap-northeast-2"')
    expect(files['main.tf']).toContain('region = var.aws_region')
  })

  it('manages RDS credentials via Secrets Manager — no plaintext password (ADR 0055)', () => {
    const { nodes, edges, securityGroups } = bestPracticeTopology()
    const files = generateTerraform(nodes, edges, securityGroups)
    // No db_password variable, no plaintext password reference; RDS-managed instead.
    expect(files['variables.tf']).not.toContain('variable "db_password"')
    expect(files['main.tf']).not.toContain('var.db_password')
    expect(files['main.tf']).toContain('manage_master_user_password = true')
  })

  it('marks an orphaned resource loudly (REPLACE_ME) instead of a broken ref', () => {
    // An EC2 with no subnet ancestor is rejected by the editor's nesting rules,
    // but if one is ever exported the HCL must NOT look appliable — REPLACE_ME
    // fails `terraform validate` on sight rather than pointing at a phantom.
    const orphan = generateTerraform([N('ec2-1', 'ec2', undefined, { instance_type: 't3.micro', ami: 'auto' })], [])
    expect(orphan['main.tf']).toContain('aws_subnet.REPLACE_ME.id')
  })

  it('honours SG inbound toggles and keeps egress allow-all', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('sg-1', 'sg', 'vpc-1', { allow_http: true, allow_https: false, allow_ssh: true }),
    ]
    const main = generateTerraform(nodes, [])['main.tf']!
    expect(main).toContain('from_port   = 80')
    expect(main).toContain('from_port   = 22')
    expect(main).not.toContain('from_port   = 443')
    expect(main).toContain('protocol    = "-1"') // egress allow-all
  })

  it('S3 is secure by default and drops the guards only when explicitly disabled', () => {
    const secure = generateTerraform(
      [N('s3-1', 's3', undefined, { versioning: true, encryption: true, block_public_access: true })],
      [],
    )['main.tf']!
    expect(secure).toContain('aws_s3_bucket_server_side_encryption_configuration')
    expect(secure).toContain('aws_s3_bucket_public_access_block')
    expect(secure).toContain('aws_s3_bucket_versioning')

    const open = generateTerraform(
      [N('s3-2', 's3', undefined, { versioning: false, encryption: false, block_public_access: false })],
      [],
    )['main.tf']!
    expect(open).not.toContain('aws_s3_bucket_server_side_encryption_configuration')
    expect(open).not.toContain('aws_s3_bucket_public_access_block')
  })
})
