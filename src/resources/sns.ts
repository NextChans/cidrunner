import { Megaphone } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * SNS — a pub/sub topic that fans one message out to many subscribers,
 * complementing SQS's point-to-point queue (ADR 0026). Producers (EC2/Lambda)
 * publish to the topic; sns → sqs / sns → lambda edges create real
 * subscriptions plus the permission each endpoint needs to accept delivery.
 */
export const sns: ResourceMeta = {
  type: 'sns',
  label: 'SNS Topic',
  description: 'Pub/Sub — 이벤트 팬아웃',
  category: 'integration',
  icon: Megaphone,
  color: 'text-fuchsia-400',
  defaults: {
    display_name: '',
  },
  // Regional service — not inside a VPC.
  allowedParents: ['canvas'],
  connectsTo: ['sqs', 'lambda'],
  fields: [
    {
      key: 'display_name',
      label: '표시 이름',
      type: 'text',
      placeholder: '(선택) SMS·이메일 발신자명',
      help: 'SMS/이메일 알림에 표시되는 이름 (선택)',
    },
  ],
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const dn = typeof config.display_name === 'string' ? config.display_name.trim() : ''
    const dnLine = dn ? `\n  display_name = "${dn}"` : ''
    const subs = (refs.subscribers ?? [])
      .map(({ kind, name: target }) => {
        if (kind === 'lambda') {
          return `

resource "aws_sns_topic_subscription" "${name}_${target}" {
  topic_arn = aws_sns_topic.${name}.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.${target}.arn
}

resource "aws_lambda_permission" "${name}_${target}_sns" {
  statement_id  = "AllowSNSInvoke-${target}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.${target}.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.${name}.arn
}`
        }
        // sqs: subscribe the queue and grant the topic SendMessage on it.
        return `

resource "aws_sns_topic_subscription" "${name}_${target}" {
  topic_arn = aws_sns_topic.${name}.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.${target}.arn
}

resource "aws_sqs_queue_policy" "${name}_${target}_policy" {
  queue_url = aws_sqs_queue.${target}.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.${target}.arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_sns_topic.${name}.arn } }
    }]
  })
}`
      })
      .join('')
    return `resource "aws_sns_topic" "${name}" {
  name = "${awsName}"${dnLine}
  tags = { Name = "${displayName}" }
}${subs}`
  },
}
