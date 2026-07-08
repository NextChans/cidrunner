import { Globe } from 'lucide-react'
import type { ResourceMeta } from './types'

/** Internet Gateway — gives public subnets a route to the internet. */
export const igw: ResourceMeta = {
  type: 'igw',
  label: 'Internet Gateway',
  description: 'VPC ↔ 인터넷 경계',
  icon: Globe,
  color: 'text-blue-400',
  defaults: {},
  // Attaches to the VPC boundary.
  allowedParents: ['vpc'],
  terraform: ({ name, awsName, refs }) => `resource "aws_internet_gateway" "${name}" {
  vpc_id = aws_vpc.${refs.vpc ?? 'REPLACE_ME'}.id
  tags = { Name = "${awsName}" }
}`,
}
