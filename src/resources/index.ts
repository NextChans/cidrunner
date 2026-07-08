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

/** Registry mapping each resource type to its metadata. */
export const resources: Record<ResourceType, ResourceMeta> = {
  vpc,
  subnet,
  igw,
  nat,
  sg,
  alb,
  ec2,
  rds,
  s3,
  lambda,
  dynamodb,
  cloudfront,
  route53,
  sqs,
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
  lambda,
  rds,
  dynamodb,
  s3,
  sqs,
  sg,
]

export function getResource(type: ResourceType): ResourceMeta {
  return resources[type]
}

export type { ResourceMeta, ResourceType } from './types'
