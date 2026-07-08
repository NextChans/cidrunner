import { Server } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect } from './validators'

/** EC2 — a compute instance running your application. */
export const ec2: ResourceMeta = {
  type: 'ec2',
  label: 'EC2 Instance',
  description: '애플리케이션 컴퓨팅',
  category: 'compute',
  icon: Server,
  color: 'text-orange-400',
  defaults: {
    instance_type: 't3.micro',
    ami: 'auto',
  },
  // Compute lives inside a subnet; talks to databases, storage, and queues.
  allowedParents: ['subnet'],
  connectsTo: ['rds', 's3', 'dynamodb', 'sqs', 'sns', 'elasticache', 'efs'],
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
    {
      key: 'ami',
      label: 'AMI',
      type: 'text',
      required: true,
      placeholder: 'auto',
      help: '"auto" = 최신 Amazon Linux 2023 자동 조회, 또는 ami-... 직접 입력',
    },
  ],
  validate: (c) => {
    const ami = typeof c.ami === 'string' ? c.ami.trim() : ''
    const ok = ami === 'auto' || /^ami-[0-9a-f]{8,}$/.test(ami)
    return collect(ok ? null : 'AMI는 "auto" 또는 ami-... 형식이어야 합니다.')
  },
  terraform: ({ name, config, refs, displayName }) => {
    const ami =
      typeof config.ami === 'string' && config.ami.startsWith('ami-')
        ? `"${config.ami}"`
        : 'data.aws_ami.al2023.id'
    const sgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`)
    const sgLine = sgs.length ? `\n  vpc_security_group_ids = [${sgs.join(', ')}]` : ''
    return `resource "aws_instance" "${name}" {
  ami           = ${ami}
  instance_type = "${config.instance_type ?? 't3.micro'}"
  subnet_id     = aws_subnet.${refs.subnet ?? 'REPLACE_ME'}.id${sgLine}
  user_data     = <<-USERDATA
    #!/bin/bash
    dnf install -y nginx
    systemctl enable --now nginx
  USERDATA
  tags = { Name = "${displayName}" }
}`
  },
}
