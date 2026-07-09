import { Shield } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * Security Group — stateful virtual firewall. Draw an edge SG → resource to
 * *attach* it (attachment edges are not traffic — see ADR 0017). The MVP
 * simplifies rules to common inbound toggles (ADR 0011); egress is allow-all.
 */
export const sg: ResourceMeta = {
  type: 'sg',
  label: 'Security Group',
  description: '스테이트풀 방화벽 — 엣지로 리소스에 연결',
  category: 'security',
  icon: Shield,
  color: 'text-rose-400',
  defaults: {
    allow_http: true,
    allow_https: true,
    allow_ssh: false,
  },
  // A VPC-scoped firewall; attach to any VPC-bound resource that owns ENIs by
  // drawing an edge (ADR 0042). Lambda is intentionally absent: this game models
  // Lambda as a non-VPC, canvas-level function, and an SG is VPC-scoped.
  allowedParents: ['vpc'],
  connectsTo: ['alb', 'ec2', 'rds', 'ecs', 'eks', 'elasticache', 'efs'],
  fields: [
    { key: 'allow_http', label: 'HTTP (80) 허용', type: 'boolean' },
    { key: 'allow_https', label: 'HTTPS (443) 허용', type: 'boolean' },
    {
      key: 'allow_ssh',
      label: 'SSH (22) 허용',
      type: 'boolean',
      help: '0.0.0.0/0 SSH 개방은 보안 경고를 발생시킵니다',
    },
  ],
  terraform: ({ name, config, refs, displayName }) => {
    const rule = (port: number, desc: string) => `
  ingress {
    description = "${desc}"
    from_port   = ${port}
    to_port     = ${port}
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }`
    // Tiered SG-to-SG ingress derived from the traffic topology (ADR 0055):
    // e.g. app SG allows the ALB SG on :80, RDS SG allows the app SG on :3306 —
    // so the exported stack actually passes traffic, not just `validate`s.
    const tiered = (refs.sgIngress ?? [])
      .map(
        (r) => `
  ingress {
    description     = "${r.desc}"
    from_port       = ${r.port}
    to_port         = ${r.port}
    protocol        = "tcp"
    security_groups = [aws_security_group.${r.fromSg}.id]
  }`,
      )
      .join('')
    const ingress =
      (config.allow_http ? rule(80, 'HTTP') : '') +
      (config.allow_https ? rule(443, 'HTTPS') : '') +
      (config.allow_ssh ? rule(22, 'SSH') : '') +
      tiered
    // No `name` attribute: AWS reserves the `sg-` prefix, and our ids start with
    // it — let AWS generate the name and tag it instead.
    return `resource "aws_security_group" "${name}" {
  description = "cidrunner: ${displayName}"
  vpc_id      = aws_vpc.${refs.vpc ?? 'REPLACE_ME'}.id
${ingress}
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${displayName}" }
}`
  },
}
