import { Zap } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validatePattern, validateRange } from './validators'

/** Lambda — a serverless function, typically fronted by API Gateway. */
export const lambda: ResourceMeta = {
  type: 'lambda',
  label: 'Lambda + API GW',
  description: '서버리스 함수',
  icon: Zap,
  color: 'text-yellow-400',
  defaults: {
    runtime: 'nodejs20.x',
    handler: 'index.handler',
    memory_mb: 128,
  },
  // Serverless — sits at the top level; reaches databases and storage.
  allowedParents: ['canvas'],
  connectsTo: ['rds', 's3'],
  fields: [
    {
      key: 'runtime',
      label: '런타임',
      type: 'select',
      options: [
        { value: 'nodejs20.x', label: 'Node.js 20.x' },
        { value: 'python3.12', label: 'Python 3.12' },
        { value: 'java21', label: 'Java 21' },
        { value: 'go1.x', label: 'Go 1.x' },
      ],
    },
    { key: 'handler', label: '핸들러', type: 'text', placeholder: 'index.handler' },
    { key: 'memory_mb', label: '메모리 (MB)', type: 'number', min: 128, max: 10240 },
  ],
  validate: (c) =>
    collect(
      validatePattern(c.handler, /^\S+$/, '핸들러를 입력하세요 (예: index.handler).'),
      validateRange(c.memory_mb, 128, 10240, '메모리'),
    ),
  // Phase 4: emit aws_lambda_function + aws_apigatewayv2_* HCL.
  terraform: () => '',
}
