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
 * Lambda — a serverless function fronted by an HTTP API Gateway. The emitter
 * generates a real execution role, an inline hello-world package (archive
 * provider), and a working API GW v2 integration so `terraform apply` yields a
 * callable endpoint.
 */
export const lambda: ResourceMeta = {
  type: 'lambda',
  label: 'Lambda + API GW',
  description: '서버리스 함수 + HTTP API',
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
}

resource "aws_apigatewayv2_api" "${name}_api" {
  name          = "${awsName}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "${name}_int" {
  api_id                 = aws_apigatewayv2_api.${name}_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.${name}.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "${name}_route" {
  api_id    = aws_apigatewayv2_api.${name}_api.id
  route_key = "$default"
  target    = "integrations/\${aws_apigatewayv2_integration.${name}_int.id}"
}

resource "aws_apigatewayv2_stage" "${name}_stage" {
  api_id      = aws_apigatewayv2_api.${name}_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "${name}_perm" {
  statement_id  = "AllowAPIGWInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.${name}.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "\${aws_apigatewayv2_api.${name}_api.execution_arn}/*"
}`
  },
}
