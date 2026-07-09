import { KeyRound } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/**
 * KMS Key — a customer-managed encryption key (ADR 0035). Other services
 * (Secrets Manager, S3, RDS) reference it as their encryption key; the game
 * wires the Secrets Manager → KMS relationship explicitly (see `secretsmanager`
 * and the `kmsKey` ref in the generator). Standalone, account-level: it carries
 * no request traffic, so it declares no edges of its own. The emitter turns on
 * automatic annual rotation, an operational best practice.
 */
export const kms: ResourceMeta = {
  type: 'kms',
  label: 'KMS Key',
  description: '고객 관리형 암호화 키',
  category: 'security',
  icon: KeyRound,
  color: 'text-amber-400',
  defaults: {
    enable_key_rotation: true,
    deletion_window_days: 30,
  },
  // Account-level key — not inside a VPC. It is only ever an edge *target*
  // (e.g. Secrets Manager → KMS), never a source.
  allowedParents: ['canvas'],
  fields: [
    {
      key: 'enable_key_rotation',
      label: '자동 키 교체',
      type: 'boolean',
      help: '매년 키 구성 요소를 자동 교체합니다',
    },
    {
      key: 'deletion_window_days',
      label: '삭제 대기 기간 (일)',
      type: 'number',
      min: 7,
      max: 30,
      help: 'destroy 후 실제 삭제까지의 유예 기간',
    },
  ],
  validate: (c) => collect(validateRange(c.deletion_window_days, 7, 30, '삭제 대기 기간')),
  terraform: ({ name, awsName, config, displayName }) => {
    const rotation = config.enable_key_rotation !== false
    const window = Number(config.deletion_window_days ?? 30)
    return `resource "aws_kms_key" "${name}" {
  description             = "${displayName}"
  deletion_window_in_days = ${window}
  enable_key_rotation     = ${rotation ? 'true' : 'false'}
  tags = { Name = "${displayName}" }
}

resource "aws_kms_alias" "${name}_alias" {
  name          = "alias/${awsName}"
  target_key_id = aws_kms_key.${name}.key_id
}`
  },
}
