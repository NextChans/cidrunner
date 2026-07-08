import type { ResourceMeta, ResourceType } from './types'
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

/** Registry mapping each resource type to its metadata. */
export const resources: Record<ResourceType, ResourceMeta> = {
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
  dynamodb,
  cloudfront,
  route53,
  sqs,
  sns,
  cloudwatch,
}

/** Palette-ordered list of resource metas (grouped by category in the UI). */
export const resourceList: ResourceMeta[] = [
  vpc,
  subnet,
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
  sqs,
  sns,
  cloudwatch,
  sg,
]

export function getResource(type: ResourceType): ResourceMeta {
  return resources[type]
}

export type { ResourceMeta, ResourceType } from './types'
