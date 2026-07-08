import { Boxes } from 'lucide-react'
import type { ResourceMeta } from './types'

/** VPC — the network boundary every other resource lives inside. */
export const vpc: ResourceMeta = {
  type: 'vpc',
  label: 'VPC',
  description: 'Isolated virtual network',
  icon: Boxes,
  color: 'text-emerald-400',
  defaults: {
    cidr_block: '10.0.0.0/16',
  },
  // Phase 4: emit aws_vpc HCL.
  terraform: () => '',
}
