import { Server } from 'lucide-react'
import type { ResourceMeta } from './types'

/** EC2 — a compute instance running your application. */
export const ec2: ResourceMeta = {
  type: 'ec2',
  label: 'EC2 Instance',
  description: '애플리케이션 컴퓨팅',
  icon: Server,
  color: 'text-orange-400',
  defaults: {
    instance_type: 't3.micro',
    ami: 'ami-xxxxxxxx',
  },
  // Compute lives inside a subnet; talks to databases and storage.
  allowedParents: ['subnet'],
  connectsTo: ['rds', 's3'],
  // Phase 4: emit aws_instance HCL.
  terraform: () => '',
}
