import { Zap } from 'lucide-react'
import type { ResourceMeta } from './types'

/** Lambda — a serverless function, typically fronted by API Gateway. */
export const lambda: ResourceMeta = {
  type: 'lambda',
  label: 'Lambda + API GW',
  description: 'Serverless function',
  icon: Zap,
  color: 'text-yellow-400',
  defaults: {
    runtime: 'nodejs20.x',
    handler: 'index.handler',
    memory_mb: 128,
  },
  // Phase 4: emit aws_lambda_function + aws_apigatewayv2_* HCL.
  terraform: () => '',
}
