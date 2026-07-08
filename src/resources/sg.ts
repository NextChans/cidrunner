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
  terraform: ({ name, awsName, config, refs }) => {
    const rule = (port: number, desc: string) => `
  ingress {
    description = "${desc}"
    from_port   = ${port}
    to_port     = ${port}
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }`
    const ingress =
      (config.allow_http ? rule(80, 'HTTP') : '') +
      (config.allow_https ? rule(443, 'HTTPS') : '') +
      (config.allow_ssh ? rule(22, 'SSH') : '')
    // No `name` attribute: AWS reserves the `sg-` prefix, and our ids start with
    // it — let AWS generate the name and tag it instead.
    return `resource "aws_security_group" "${name}" {
  vpc_id = aws_vpc.${refs.vpc ?? 'REPLACE_ME'}.id
${ingress}
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${awsName}" }
}`
  },
}
