import { Waves } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/**
 * Kinesis Data Stream — a real-time streaming ingestion point (ADR 0035,
 * resolving the Sprint B deferral). It is a simulation *entry* (a stream that
 * nothing else feeds starts a data pipeline) and connects to Lambda consumers;
 * a `kinesis → lambda` edge emits a real event source mapping so
 * `terraform apply` yields a working stream → consumer wiring.
 */
export const kinesis: ResourceMeta = {
  type: 'kinesis',
  label: 'Kinesis Data Stream',
  description: '실시간 데이터 스트림',
  category: 'integration',
  icon: Waves,
  color: 'text-cyan-400',
  defaults: {
    mode: 'ON_DEMAND',
    shard_count: 1,
    retention_hours: 24,
  },
  // Regional streaming service — not inside a VPC.
  allowedParents: ['canvas'],
  connectsTo: ['lambda'],
  fields: [
    {
      key: 'mode',
      label: '용량 모드',
      type: 'select',
      options: [
        { value: 'ON_DEMAND', label: '온디맨드' },
        { value: 'PROVISIONED', label: '프로비저닝 (샤드 지정)' },
      ],
    },
    {
      key: 'shard_count',
      label: '샤드 수',
      type: 'number',
      min: 1,
      max: 1000,
      help: '프로비저닝 모드에서만 적용됩니다',
    },
    {
      key: 'retention_hours',
      label: '보존 기간 (시간)',
      type: 'number',
      min: 24,
      max: 8760,
    },
  ],
  validate: (c) =>
    collect(
      validateRange(c.shard_count, 1, 1000, '샤드 수'),
      validateRange(c.retention_hours, 24, 8760, '보존 기간'),
    ),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const onDemand = config.mode !== 'PROVISIONED'
    const shards = Number(config.shard_count ?? 1)
    const retention = Number(config.retention_hours ?? 24)
    const modeBlock = onDemand
      ? `
  stream_mode_details {
    stream_mode = "ON_DEMAND"
  }`
      : `\n  shard_count = ${shards}`
    // A stream-fed Lambda needs an event source mapping and Kinesis read perms.
    const mappings = (refs.consumers ?? [])
      .map(
        (fn) => `

resource "aws_lambda_event_source_mapping" "${name}_${fn}" {
  event_source_arn  = aws_kinesis_stream.${name}.arn
  function_name     = aws_lambda_function.${fn}.arn
  starting_position = "LATEST"
  batch_size        = 100
}

resource "aws_iam_role_policy_attachment" "${name}_${fn}_kinesis" {
  role       = aws_iam_role.${fn}_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaKinesisExecutionRole"
}`,
      )
      .join('')
    return `resource "aws_kinesis_stream" "${name}" {
  name             = "${awsName}"
  retention_period = ${retention}${modeBlock}
  tags = { Name = "${displayName}" }
}${mappings}`
  },
}
