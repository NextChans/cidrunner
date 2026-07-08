import { Scale } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/** Application Load Balancer — L7 traffic distribution across targets. */
export const alb: ResourceMeta = {
  type: 'alb',
  label: 'Load Balancer',
  description: 'L7 트래픽 분산',
  icon: Scale,
  color: 'text-violet-400',
  defaults: {
    internal: false,
    listener_port: 80,
  },
  // Spans a VPC's subnets; forwards traffic to compute targets.
  allowedParents: ['vpc'],
  connectsTo: ['ec2', 'lambda'],
  fields: [
    {
      key: 'internal',
      label: '내부(Internal) LB',
      type: 'boolean',
      help: '켜면 VPC 내부에서만 접근 가능',
    },
    { key: 'listener_port', label: '리스너 포트', type: 'number', min: 1, max: 65535 },
  ],
  validate: (c) => collect(validateRange(c.listener_port, 1, 65535, '리스너 포트')),
  // Phase 4: emit aws_lb + target group + listener HCL.
  terraform: () => '',
}
