import { Zap } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validatePattern, validateRange } from './validators'

interface InlineSource {
  filename: string
  content: string
}

/** Default (Node.js) inline package — also the fallback for unknown runtimes. */
const NODEJS_SOURCE: InlineSource = {
  filename: 'index.js',
  content:
    "exports.handler = async () => ({ statusCode: 200, body: 'Hello from cidrunner' });",
}

/** Per-runtime inline hello-world source, zipped by the archive provider. */
const INLINE_SOURCE: Record<string, InlineSource> = {
  'nodejs20.x': NODEJS_SOURCE,
  'python3.12': {
    filename: 'index.py',
    content:
      "def handler(event, context):\\n    return {'statusCode': 200, 'body': 'Hello from cidrunner'}",
  },
}

/**
 * Lambda — a standalone serverless function. The emitter generates a real
 * execution role and an inline hello-world package (archive provider) so
 * `terraform apply` yields a deployable function. HTTP fronting is now a
 * separate API Gateway resource (ADR 0046) that integrates via an `apigw →
 * lambda` edge, so a Lambda block no longer bundles its own endpoint.
 */
export const lambda: ResourceMeta = {
  type: 'lambda',
  label: 'Lambda',
  description: '서버리스 함수',
  category: 'compute',
  icon: Zap,
  color: 'text-yellow-400',
  defaults: {
    runtime: 'nodejs20.x',
    handler: 'index.handler',
    memory_mb: 128,
  },
  // Serverless — sits at the top level; reaches databases, storage, and queues.
  allowedParents: ['canvas'],
  connectsTo: ['rds', 's3', 'dynamodb', 'sqs', 'sns', 'elasticache'],
  fields: [
    {
      key: 'runtime',
      label: '런타임',
      type: 'select',
      options: [
        { value: 'nodejs20.x', label: 'Node.js 20.x' },
        { value: 'python3.12', label: 'Python 3.12' },
      ],
    },
    {
      key: 'handler',
      label: '핸들러',
      type: 'text',
      required: true,
      placeholder: 'index.handler',
      help: '내장 hello-world 코드는 index.handler를 사용합니다',
    },
    { key: 'memory_mb', label: '메모리 (MB)', type: 'number', min: 128, max: 10240 },
  ],
  validate: (c) =>
    collect(
      validatePattern(c.handler, /^\S+$/, '핸들러를 입력하세요 (예: index.handler).'),
      validateRange(c.memory_mb, 128, 10240, '메모리'),
    ),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const runtime = typeof config.runtime === 'string' ? config.runtime : 'nodejs20.x'
    const src = INLINE_SOURCE[runtime] ?? NODEJS_SOURCE
    // A queue-fed Lambda needs SQS receive/delete permissions on its role.
    const sqsPolicy = refs.sqsSources?.length
      ? `

resource "aws_iam_role_policy_attachment" "${name}_sqs" {
  role       = aws_iam_role.${name}_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}`
      : ''
    return `resource "aws_iam_role" "${name}_role" {
  name_prefix = "${awsName.slice(0, 24)}-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "${name}_logs" {
  role       = aws_iam_role.${name}_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}${sqsPolicy}

data "archive_file" "${name}_zip" {
  type        = "zip"
  output_path = "\${path.module}/${name}.zip"
  source {
    content  = "${src.content}"
    filename = "${src.filename}"
  }
}

resource "aws_lambda_function" "${name}" {
  function_name    = "${awsName}"
  role             = aws_iam_role.${name}_role.arn
  handler          = "${config.handler ?? 'index.handler'}"
  runtime          = "${runtime}"
  memory_size      = ${Number(config.memory_mb ?? 128)}
  filename         = data.archive_file.${name}_zip.output_path
  source_code_hash = data.archive_file.${name}_zip.output_base64sha256
  tags = { Name = "${displayName}" }
}`
  },
}
