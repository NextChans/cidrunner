import { Lock } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/**
 * Secrets Manager — stores and rotates DB / API credentials (ADR 0035). A
 * `secretsmanager → kms` edge encrypts the secret with a customer-managed key
 * instead of the default `aws/secretsmanager` key; the generator resolves the
 * key name into `refs.kmsKey`. The emitter creates the secret *container* only
 * (no value): Terraform manages the secret, the value is populated out of band,
 * so no plaintext credential is ever written into the generated HCL.
 */
export const secretsmanager: ResourceMeta = {
  type: 'secretsmanager',
  label: 'Secrets Manager',
  description: 'DB·API 시크릿 저장·교체',
  category: 'security',
  icon: Lock,
  color: 'text-rose-400',
  defaults: {
    recovery_window_days: 30,
  },
  // Regional service — not inside a VPC. May point at a KMS key for encryption.
  allowedParents: ['canvas'],
  connectsTo: ['kms'],
  fields: [
    {
      key: 'recovery_window_days',
      label: '복구 대기 기간 (일)',
      type: 'number',
      min: 0,
      max: 30,
      help: '0이면 즉시 삭제 (복구 불가)',
    },
  ],
  validate: (c) => collect(validateRange(c.recovery_window_days, 0, 30, '복구 대기 기간')),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const window = Number(config.recovery_window_days ?? 30)
    const kmsLine = refs.kmsKey ? `\n  kms_key_id              = aws_kms_key.${refs.kmsKey}.arn` : ''
    return `resource "aws_secretsmanager_secret" "${name}" {
  name_prefix             = "${awsName}-"
  recovery_window_in_days = ${window}${kmsLine}
  tags = { Name = "${displayName}" }
}`
  },
}
