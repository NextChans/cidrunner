import type { ResourceMeta, ResourceType } from './types'
import { account } from './account'
import { az } from './az'
import { vpc } from './vpc'
import { subnet } from './subnet'
import { igw } from './igw'
import { nat } from './nat'
import { sg } from './sg'
import { alb } from './alb'
import { ec2 } from './ec2'
import { rds } from './rds'
import { s3 } from './s3'
import { lambda } from './lambda'
import { apigw } from './apigw'
import { dynamodb } from './dynamodb'
import { cloudfront } from './cloudfront'
import { route53 } from './route53'
import { sqs } from './sqs'
import { ecs } from './ecs'
import { eks } from './eks'
import { sns } from './sns'
import { efs } from './efs'
import { elasticache } from './elasticache'
import { cloudwatch } from './cloudwatch'
import { cognito } from './cognito'
import { secretsmanager } from './secretsmanager'
import { kms } from './kms'
import { acm } from './acm'
import { waf } from './waf'
import { kinesis } from './kinesis'
import { ecr } from './ecr'
import { cloudtrail } from './cloudtrail'

/** Registry mapping each resource type to its metadata. */
export const resources: Record<ResourceType, ResourceMeta> = {
  account,
  az,
  vpc,
  subnet,
  igw,
  nat,
  sg,
  alb,
  ec2,
  ecs,
  eks,
  rds,
  elasticache,
  s3,
  efs,
  lambda,
  apigw,
  dynamodb,
  cloudfront,
  route53,
  sqs,
  sns,
  cloudwatch,
  cognito,
  secretsmanager,
  kms,
  acm,
  waf,
  kinesis,
  ecr,
  cloudtrail,
}

/** Palette-ordered list of resource metas (grouped by category in the UI). */
export const resourceList: ResourceMeta[] = [
  account,
  vpc,
  subnet,
  az,
  igw,
  nat,
  route53,
  cloudfront,
  alb,
  ec2,
  ecs,
  eks,
  lambda,
  rds,
  elasticache,
  dynamodb,
  s3,
  efs,
  ecr,
  apigw,
  kinesis,
  sqs,
  sns,
  cloudwatch,
  cloudtrail,
  cognito,
  secretsmanager,
  kms,
  acm,
  waf,
]

export function getResource(type: ResourceType): ResourceMeta {
  return resources[type]
}

export type { ResourceMeta, ResourceType } from './types'
