import { Waypoints } from 'lucide-react'
import type { ResourceMeta } from './types'

/** NAT Gateway — lets private subnets reach the internet outbound-only. */
export const nat: ResourceMeta = {
  type: 'nat',
  label: 'NAT Gateway',
  description: 'Private subnet egress',
  icon: Waypoints,
  color: 'text-amber-400',
  defaults: {},
  // Phase 4: emit aws_nat_gateway (+ EIP) HCL.
  terraform: () => '',
}
