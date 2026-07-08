import { Shield } from 'lucide-react'
import type { ResourceMeta } from './types'

/** Security Group — stateful virtual firewall attached to resources. */
export const sg: ResourceMeta = {
  type: 'sg',
  label: 'Security Group',
  description: '스테이트풀 방화벽',
  icon: Shield,
  color: 'text-rose-400',
  // MVP simplifies SG rules to a few common ingress toggles (see ADR 0011);
  // egress defaults to allow-all in the emitted Terraform.
  defaults: {
    allow_http: true,
    allow_https: true,
    allow_ssh: false,
  },
  // A VPC-scoped firewall.
  allowedParents: ['vpc'],
  fields: [
    { key: 'allow_http', label: 'HTTP (80) 허용', type: 'boolean' },
    { key: 'allow_https', label: 'HTTPS (443) 허용', type: 'boolean' },
    { key: 'allow_ssh', label: 'SSH (22) 허용', type: 'boolean', help: '운영 환경에서는 권장하지 않습니다' },
  ],
  // Phase 4: emit aws_security_group HCL.
  terraform: () => '',
}
