import { Boxes } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateCidr } from './validators'

/** VPC — the network boundary every other resource lives inside. */
export const vpc: ResourceMeta = {
  type: 'vpc',
  label: 'VPC',
  description: '격리된 가상 네트워크',
  category: 'network',
  icon: Boxes,
  color: 'text-emerald-400',
  defaults: {
    cidr_block: '10.0.0.0/16',
  },
  // Top-level network boundary; may also sit inside an AWS Account box (ADR 0050).
  allowedParents: ['canvas', 'account'],
  container: true,
  defaultSize: { width: 480, height: 340 },
  fields: [
    {
      key: 'cidr_block',
      label: 'CIDR 블록',
      type: 'text',
      required: true,
      placeholder: '10.0.0.0/16',
    },
  ],
  validate: (c) => collect(validateCidr(c.cidr_block)),
  // DNS support/hostnames on: required for RDS endpoints and instance DNS.
  terraform: ({ name, config, displayName }) => `resource "aws_vpc" "${name}" {
  cidr_block           = "${config.cidr_block ?? '10.0.0.0/16'}"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "${displayName}" }
}`,
}
