import type { Mission } from './types'

export const serverless: Mission = {
  id: 'serverless',
  title: 'Serverless API',
  description:
    'Skip the servers. Wire API Gateway to a Lambda function and persist data in S3 — no VPC required.',
  goal: 'Route client → API Gateway → Lambda → S3.',
  hint: 'The Lambda block bundles API Gateway. Connect it straight to storage.',
  requiredResources: ['lambda', 's3'],
}
