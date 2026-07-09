import { Scale } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/** Application Load Balancer — L7 traffic distribution across targets. */
export const alb: ResourceMeta = {
  type: 'alb',
  label: 'Load Balancer',
  description: 'L7 트래픽 분산 (2개 AZ 필요)',
  category: 'network',
  icon: Scale,
  color: 'text-violet-400',
  defaults: {
    internal: false,
    listener_port: 80,
  },
  // Spans a VPC's subnets; forwards traffic to compute targets.
  allowedParents: ['vpc'],
  connectsTo: ['ec2', 'lambda', 'ecs', 'eks'],
  fields: [
    {
      key: 'internal',
      label: '내부(Internal) LB',
      type: 'boolean',
      help: '켜면 VPC 내부에서만 접근 가능',
    },
    {
      key: 'listener_port',
      label: '리스너 포트',
      type: 'number',
      required: true,
      min: 1,
      max: 65535,
    },
  ],
  validate: (c) => collect(validateRange(c.listener_port, 1, 65535, '리스너 포트')),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const port = Number(config.listener_port ?? 80)
    // An internet-facing ALB MUST sit in public subnets; an internal one in any
    // subnet. There is no valid fallback for an external ALB with no public
    // subnet — checks.ts already flags that as an error, so silently placing it
    // in private subnets only emits wrong-but-plausible HCL that can never
    // apply. Mark the gap with REPLACE_ME instead (ADR 0044), matching ECS/EKS.
    const subnetPool = config.internal ? (refs.subnets ?? []) : (refs.publicSubnets ?? [])
    const subnets = (subnetPool.length ? subnetPool : ['REPLACE_ME'])
      .map((s) => `aws_subnet.${s}.id`)
      .join(', ')
    const sgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`).join(', ')
    const attachments = (refs.targets ?? [])
      .map(
        (t) => `

resource "aws_lb_target_group_attachment" "${name}_${t}" {
  target_group_arn = aws_lb_target_group.${name}_tg.arn
  target_id        = aws_instance.${t}.id
  port             = ${port}
}`,
      )
      .join('')
    // With an ACM certificate attached (acm → alb edge, ADR 0056) the ALB
    // terminates TLS: HTTPS:443 forwards to the targets and HTTP:80 redirects
    // up to it, so no plaintext traffic is served. Without a cert we keep the
    // plain HTTP listener on the configured port (the readiness manifest flags
    // the missing TLS).
    const cert = refs.certificate
    const listeners = cert
      ? `resource "aws_lb_listener" "${name}_https" {
  load_balancer_arn = aws_lb.${name}.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.${cert}.arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.${name}_tg.arn
  }
}

resource "aws_lb_listener" "${name}_listener" {
  load_balancer_arn = aws_lb.${name}.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}`
      : `resource "aws_lb_listener" "${name}_listener" {
  load_balancer_arn = aws_lb.${name}.arn
  port              = ${port}
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.${name}_tg.arn
  }
}`
    return `resource "aws_lb" "${name}" {
  name               = "${awsName}"
  internal           = ${config.internal ? 'true' : 'false'}
  load_balancer_type = "application"
  security_groups    = [${sgs}]
  subnets            = [${subnets}]
  tags = { Name = "${displayName}" }
}

resource "aws_lb_target_group" "${name}_tg" {
  name     = "${awsName}-tg"
  port     = ${port}
  protocol = "HTTP"
  vpc_id   = aws_vpc.${refs.vpc ?? 'REPLACE_ME'}.id
  health_check {
    path    = "/"
    matcher = "200-399"
  }
}

${listeners}${attachments}`
  },
}
