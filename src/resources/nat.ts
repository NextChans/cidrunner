import { Waypoints } from 'lucide-react'
import type { ResourceMeta } from './types'

/** NAT Gateway — lets private subnets reach the internet outbound-only. */
export const nat: ResourceMeta = {
  type: 'nat',
  label: 'NAT Gateway',
  description: '프라이빗 서브넷 아웃바운드',
  category: 'network',
  icon: Waypoints,
  color: 'text-amber-400',
  defaults: {},
  // Must live in a PUBLIC subnet (enforced by graph checks). Private route
  // tables via this NAT are generated automatically (see graph/terraform.ts).
  allowedParents: ['subnet'],
  terraform: ({ name, refs, displayName }) => `resource "aws_eip" "${name}_eip" {
  domain = "vpc"
}

resource "aws_nat_gateway" "${name}" {
  allocation_id = aws_eip.${name}_eip.id
  subnet_id     = aws_subnet.${refs.subnet ?? 'REPLACE_ME'}.id
  tags = { Name = "${displayName}" }
}`,
}
