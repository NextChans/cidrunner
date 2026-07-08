import { Inbox } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/**
 * SQS — a message queue decoupling producers (EC2/Lambda) from Lambda
 * consumers. An sqs → lambda edge emits a real event source mapping.
 */
export const sqs: ResourceMeta = {
  type: 'sqs',
  label: 'SQS Queue',
  description: '메시지 큐 — 비동기 디커플링',
  category: 'integration',
  icon: Inbox,
  color: 'text-pink-400',
  defaults: {
    fifo: false,
    visibility_timeout: 30,
  },
  // Regional service — not inside a VPC.
  allowedParents: ['canvas'],
  connectsTo: ['lambda'],
  fields: [
    { key: 'fifo', label: 'FIFO 큐', type: 'boolean', help: '순서 보장 + 정확히 1회 처리' },
    {
      key: 'visibility_timeout',
      label: '가시성 타임아웃 (초)',
      type: 'number',
      min: 0,
      max: 43200,
    },
  ],
  validate: (c) => collect(validateRange(c.visibility_timeout, 0, 43200, '가시성 타임아웃')),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const fifo = config.fifo === true
    const mappings = (refs.consumers ?? [])
      .map(
        (fn) => `

resource "aws_lambda_event_source_mapping" "${name}_${fn}" {
  event_source_arn = aws_sqs_queue.${name}.arn
  function_name    = aws_lambda_function.${fn}.arn
  batch_size       = 10
}`,
      )
      .join('')
    return `resource "aws_sqs_queue" "${name}" {
  name                       = "${awsName}${fifo ? '.fifo' : ''}"${fifo ? '\n  fifo_queue                 = true\n  content_based_deduplication = true' : ''}
  visibility_timeout_seconds = ${Number(config.visibility_timeout ?? 30)}
  tags = { Name = "${displayName}" }
}${mappings}`
  },
}
