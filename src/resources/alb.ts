import { Scale } from 'lucide-react'
import type { ResourceMeta } from './types'

/** Application Load Balancer — L7 traffic distribution across targets. */
export const alb: ResourceMeta = {
  type: 'alb',
  label: 'Load Balancer',
  description: 'L7 traffic distribution',
  icon: Scale,
  color: 'text-violet-400',
  defaults: {
    internal: false,
    listener_port: 80,
  },
  // Phase 4: emit aws_lb + target group + listener HCL.
  terraform: () => '',
}
