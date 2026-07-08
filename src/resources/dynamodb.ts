import { Table } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validatePattern, validateRange } from './validators'

/** DynamoDB — a serverless key-value table; a data sink like RDS/S3. */
export const dynamodb: ResourceMeta = {
  type: 'dynamodb',
  label: 'DynamoDB',
  description: '서버리스 키-값 테이블',
  category: 'database',
  icon: Table,
  color: 'text-purple-400',
  defaults: {
    billing_mode: 'PAY_PER_REQUEST',
    hash_key: 'id',
    rcu: 5,
    wcu: 5,
  },
  // Regional service — not inside a VPC.
  allowedParents: ['canvas'],
  fields: [
    {
      key: 'billing_mode',
      label: '과금 모드',
      type: 'select',
      options: [
        { value: 'PAY_PER_REQUEST', label: '온디맨드 (권장)' },
        { value: 'PROVISIONED', label: '프로비저닝' },
      ],
    },
    {
      key: 'hash_key',
      label: '파티션 키',
      type: 'text',
      required: true,
      placeholder: 'id',
    },
    { key: 'rcu', label: 'RCU (프로비저닝 시)', type: 'number', min: 1, max: 40000 },
    { key: 'wcu', label: 'WCU (프로비저닝 시)', type: 'number', min: 1, max: 40000 },
  ],
  validate: (c) =>
    collect(
      validatePattern(c.hash_key, /^[A-Za-z0-9_.-]+$/, '파티션 키를 입력하세요 (영숫자/_-.).'),
      c.billing_mode === 'PROVISIONED' ? validateRange(c.rcu, 1, 40000, 'RCU') : null,
      c.billing_mode === 'PROVISIONED' ? validateRange(c.wcu, 1, 40000, 'WCU') : null,
    ),
  terraform: ({ name, awsName, config, displayName }) => {
    const provisioned = config.billing_mode === 'PROVISIONED'
    const capacity = provisioned
      ? `\n  read_capacity  = ${Number(config.rcu ?? 5)}\n  write_capacity = ${Number(config.wcu ?? 5)}`
      : ''
    return `resource "aws_dynamodb_table" "${name}" {
  name         = "${awsName}"
  billing_mode = "${provisioned ? 'PROVISIONED' : 'PAY_PER_REQUEST'}"
  hash_key     = "${config.hash_key ?? 'id'}"${capacity}
  attribute {
    name = "${config.hash_key ?? 'id'}"
    type = "S"
  }
  tags = { Name = "${displayName}" }
}`
  },
}
