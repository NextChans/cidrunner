import { Boxes } from 'lucide-react'
import type { ResourceMeta } from './types'

/** VPC — the network boundary every other resource lives inside. */
export const vpc: ResourceMeta = {
  type: 'vpc',
  label: 'VPC',
  description: '격리된 가상 네트워크',
  icon: Boxes,
  color: 'text-emerald-400',
  defaults: {
    cidr_block: '10.0.0.0/16',
  },
  // Top-level network boundary; holds subnets and VPC-scoped resources.
  allowedParents: ['canvas'],
  container: true,
  defaultSize: { width: 480, height: 340 },
  // Phase 4: emit aws_vpc HCL.
  terraform: () => '',
}
