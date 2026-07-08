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
  terraform: ({ name, awsName, config, refs }) => {
    const port = Number(config.listener_port ?? 80)
    const subnets = (refs.subnets ?? []).map((s) => `aws_subnet.${s}.id`).join(', ')
    const sgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`).join(', ')
    return `resource "aws_lb" "${name}" {
  name               = "${awsName}"
  internal           = ${config.internal ? 'true' : 'false'}
  load_balancer_type = "application"
  security_groups    = [${sgs}]
  subnets            = [${subnets}]
}

resource "aws_lb_target_group" "${name}_tg" {
  name     = "${awsName}-tg"
  port     = ${port}
  protocol = "HTTP"
  vpc_id   = aws_vpc.${refs.vpc ?? 'REPLACE_ME'}.id
}

resource "aws_lb_listener" "${name}_listener" {
  load_balancer_arn = aws_lb.${name}.arn
  port              = ${port}
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.${name}_tg.arn
  }
}`
  },
}
