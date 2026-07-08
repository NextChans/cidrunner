import { Box } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateCidr } from './validators'

/** Subnet — a CIDR slice of a VPC, public or private. */
export const subnet: ResourceMeta = {
  type: 'subnet',
  label: 'Subnet',
  description: 'VPC의 CIDR 구간',
  icon: Box,
  color: 'text-sky-400',
  defaults: {
    cidr_block: '10.0.1.0/24',
    public: false,
  },
  // A CIDR slice of a VPC; itself a container for compute/database nodes.
  allowedParents: ['vpc'],
  container: true,
  defaultSize: { width: 320, height: 190 },
  fields: [
    { key: 'cidr_block', label: 'CIDR 블록', type: 'text', placeholder: '10.0.1.0/24' },
    { key: 'public', label: '퍼블릭 서브넷', type: 'boolean', help: '인터넷에서 직접 접근 가능' },
  ],
  validate: (c) => collect(validateCidr(c.cidr_block)),
  // Phase 4: emit aws_subnet HCL.
  terraform: () => '',
}
