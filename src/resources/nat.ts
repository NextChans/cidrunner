import { Waypoints } from 'lucide-react'
import type { ResourceMeta } from './types'

/** NAT Gateway — lets private subnets reach the internet outbound-only. */
export const nat: ResourceMeta = {
  type: 'nat',
  label: 'NAT Gateway',
  description: '프라이빗 서브넷 아웃바운드',
  icon: Waypoints,
  color: 'text-amber-400',
  defaults: {},
  // Phase 4: emit aws_nat_gateway (+ EIP) HCL.
  terraform: () => '',
}
