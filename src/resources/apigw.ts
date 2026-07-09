import { Webhook } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validatePattern } from './validators'

/**
 * API Gateway (REST API) — the HTTP entry point that fronts a Lambda function
 * (ADR 0046). Split out of the former "Lambda + API GW" combo so the two
 * concerns are modeled as distinct blocks connected by an `apigw → lambda`
 * proxy-integration edge. The emitter generates a `{proxy+}` catch-all resource
 * wired to the connected Lambda via `AWS_PROXY`, plus the deployment, stage, and
 * invoke permission so `terraform apply` yields a callable endpoint.
 */
export const apigw: ResourceMeta = {
  type: 'apigw',
  label: 'API Gateway',
  description: 'REST API 엔드포인트',
  category: 'integration',
  icon: Webhook,
  color: 'text-rose-300',
  defaults: {
    stage_name: 'prod',
    endpoint_type: 'regional',
  },
  // A regional/edge REST API lives outside the VPC and proxies to a Lambda.
  allowedParents: ['canvas'],
  connectsTo: ['lambda'],
  fields: [
    {
      key: 'stage_name',
      label: '스테이지',
      type: 'text',
      required: true,
      placeholder: 'prod',
      help: '배포 스테이지 이름 (URL 경로 접두어).',
    },
    {
      key: 'endpoint_type',
      label: '엔드포인트 타입',
      type: 'select',
      options: [
        { value: 'regional', label: 'Regional' },
        { value: 'edge', label: 'Edge-optimized' },
      ],
    },
  ],
  validate: (c) =>
    collect(
      validatePattern(
        c.stage_name,
        /^[a-zA-Z0-9_-]+$/,
        '스테이지 이름은 영숫자/하이픈/언더스코어만 사용할 수 있습니다.',
      ),
    ),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const stage = typeof config.stage_name === 'string' && config.stage_name ? config.stage_name : 'prod'
    const endpointType = config.endpoint_type === 'edge' ? 'EDGE' : 'REGIONAL'
    // The integration proxies to the Lambda joined via an `apigw → lambda` edge.
    // With none connected, mark the gap loudly (ADR 0044/0046) so the export is
    // never a silently broken API with no backend.
    const lambda = refs.integrationTarget
    const lambdaFn = lambda ? `aws_lambda_function.${lambda}` : 'REPLACE_ME'
    const permission = lambda
      ? `

resource "aws_lambda_permission" "${name}_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = ${lambdaFn}.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "\${aws_api_gateway_rest_api.${name}.execution_arn}/*/*"
}`
      : `

# NOTE: connect this API Gateway to a Lambda (apigw → lambda edge) to wire the
# proxy integration and invoke permission — see ADR 0046.`
    return `resource "aws_api_gateway_rest_api" "${name}" {
  name = "${awsName}"
  endpoint_configuration {
    types = ["${endpointType}"]
  }
  tags = { Name = "${displayName}" }
}

resource "aws_api_gateway_resource" "${name}_proxy" {
  rest_api_id = aws_api_gateway_rest_api.${name}.id
  parent_id   = aws_api_gateway_rest_api.${name}.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "${name}_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.${name}.id
  resource_id   = aws_api_gateway_resource.${name}_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "${name}_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.${name}.id
  resource_id             = aws_api_gateway_resource.${name}_proxy.id
  http_method             = aws_api_gateway_method.${name}_proxy.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = ${lambda ? `${lambdaFn}.invoke_arn` : '"REPLACE_ME"'}
}

resource "aws_api_gateway_deployment" "${name}" {
  rest_api_id = aws_api_gateway_rest_api.${name}.id
  depends_on  = [aws_api_gateway_integration.${name}_lambda]
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "${name}" {
  rest_api_id   = aws_api_gateway_rest_api.${name}.id
  deployment_id = aws_api_gateway_deployment.${name}.id
  stage_name    = "${stage}"
}${permission}`
  },
}
