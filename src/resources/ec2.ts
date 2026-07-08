import { Server } from 'lucide-react'
import type { ResourceMeta } from './types'

/** EC2 — a compute instance running your application. */
export const ec2: ResourceMeta = {
  type: 'ec2',
  label: 'EC2 Instance',
  description: 'Application compute',
  icon: Server,
  color: 'text-orange-400',
  defaults: {
    instance_type: 't3.micro',
    ami: 'ami-xxxxxxxx',
  },
  // Phase 4: emit aws_instance HCL.
  terraform: () => '',
}
