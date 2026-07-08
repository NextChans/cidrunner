import { Box } from 'lucide-react'
import type { ResourceMeta } from './types'

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
  // Phase 4: emit aws_subnet HCL.
  terraform: () => '',
}
