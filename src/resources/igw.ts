import { Globe } from 'lucide-react'
import type { ResourceMeta } from './types'

/** Internet Gateway — gives public subnets a route to the internet. */
export const igw: ResourceMeta = {
  type: 'igw',
  label: 'Internet Gateway',
  description: 'VPC ↔ 인터넷 경계',
  category: 'network',
  icon: Globe,
  color: 'text-blue-400',
  defaults: {},
  // Attaches to the VPC boundary. Public route tables are generated
  // automatically when an IGW is present (see graph/terraform.ts).
  allowedParents: ['vpc'],
  terraform: ({ name, refs, displayName }) => `resource "aws_internet_gateway" "${name}" {
  vpc_id = aws_vpc.${refs.vpc ?? 'REPLACE_ME'}.id
  tags = { Name = "${displayName}" }
}`,
}
