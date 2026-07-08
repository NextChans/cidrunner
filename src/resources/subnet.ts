import { Box } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateCidr } from './validators'

/** Subnet — a CIDR slice of a VPC, public or private, pinned to one AZ. */
export const subnet: ResourceMeta = {
  type: 'subnet',
  label: 'Subnet',
  description: 'VPC의 CIDR 구간 (단일 AZ)',
  category: 'network',
  icon: Box,
  color: 'text-sky-400',
  defaults: {
    cidr_block: '10.0.1.0/24',
    az: 'a',
    public: false,
  },
  // A CIDR slice of a VPC; itself a container for compute/database nodes.
  allowedParents: ['vpc'],
  container: true,
  defaultSize: { width: 320, height: 190 },
  fields: [
    {
      key: 'cidr_block',
      label: 'CIDR 블록',
      type: 'text',
      required: true,
      placeholder: '10.0.1.0/24',
    },
    {
      key: 'az',
      label: '가용 영역 (AZ)',
      type: 'select',
      options: [
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
        { value: 'c', label: 'c' },
      ],
      help: 'ALB·RDS는 서로 다른 AZ의 Subnet 2개 이상이 필요합니다',
    },
    { key: 'public', label: '퍼블릭 서브넷', type: 'boolean', help: '인터넷에서 직접 접근 가능' },
  ],
  validate: (c) => collect(validateCidr(c.cidr_block)),
  terraform: ({ name, config, refs, displayName }) => `resource "aws_subnet" "${name}" {
  vpc_id                  = aws_vpc.${refs.vpc ?? 'REPLACE_ME'}.id
  cidr_block              = "${config.cidr_block ?? '10.0.1.0/24'}"
  availability_zone       = "\${var.aws_region}${config.az ?? 'a'}"
  map_public_ip_on_launch = ${config.public ? 'true' : 'false'}
  tags = { Name = "${displayName}" }
}`,
}
