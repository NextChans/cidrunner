import { Boxes } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateCidr } from './validators'

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
  fields: [
    { key: 'cidr_block', label: 'CIDR 블록', type: 'text', placeholder: '10.0.0.0/16' },
  ],
  validate: (c) => collect(validateCidr(c.cidr_block)),
  // Phase 4: emit aws_vpc HCL.
  terraform: () => '',
}
