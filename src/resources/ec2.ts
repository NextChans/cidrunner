import { Server } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validatePattern } from './validators'

/** EC2 — a compute instance running your application. */
export const ec2: ResourceMeta = {
  type: 'ec2',
  label: 'EC2 Instance',
  description: '애플리케이션 컴퓨팅',
  icon: Server,
  color: 'text-orange-400',
  defaults: {
    instance_type: 't3.micro',
    ami: 'ami-0abcd1234ef567890',
  },
  // Compute lives inside a subnet; talks to databases and storage.
  allowedParents: ['subnet'],
  connectsTo: ['rds', 's3'],
  fields: [
    {
      key: 'instance_type',
      label: '인스턴스 타입',
      type: 'select',
      options: [
        { value: 't3.micro', label: 't3.micro' },
        { value: 't3.small', label: 't3.small' },
        { value: 't3.medium', label: 't3.medium' },
        { value: 'm5.large', label: 'm5.large' },
      ],
    },
    { key: 'ami', label: 'AMI ID', type: 'text', placeholder: 'ami-0abcd1234' },
  ],
  validate: (c) =>
    collect(
      validatePattern(c.ami, /^ami-[0-9a-f]{8,}$/, 'AMI ID 형식이 올바르지 않습니다 (예: ami-0abcd1234ef567890).'),
    ),
  // Phase 4: emit aws_instance HCL.
  terraform: () => '',
}
