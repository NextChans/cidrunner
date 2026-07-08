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
}

/** Palette-ordered list of resource metas. */
export const resourceList: ResourceMeta[] = [
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
]

export function getResource(type: ResourceType): ResourceMeta {
  return resources[type]
}

export type { ResourceMeta, ResourceType } from './types'
