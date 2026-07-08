import { Shield } from 'lucide-react'
import type { ResourceMeta } from './types'

/** Security Group — stateful virtual firewall attached to resources. */
export const sg: ResourceMeta = {
  type: 'sg',
  label: 'Security Group',
  description: '스테이트풀 방화벽',
  icon: Shield,
  color: 'text-rose-400',
  defaults: {
    ingress: [],
    egress: [],
  },
  // A VPC-scoped firewall.
  allowedParents: ['vpc'],
  // Phase 4: emit aws_security_group HCL.
  terraform: () => '',
}
