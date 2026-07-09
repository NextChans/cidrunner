import { BadgeCheck } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validatePattern } from './validators'

/**
 * ACM Certificate — a TLS certificate for ALB / CloudFront (ADR 0035). Fronting
 * services reference it out of band, so it declares no traffic edges. The
 * emitter requests a DNS-validated certificate; `terraform apply` creates the
 * request immediately (it stays PENDING_VALIDATION until the DNS records are
 * published), which is the standard apply-ready shape for ACM.
 */
export const acm: ResourceMeta = {
  type: 'acm',
  label: 'ACM Certificate',
  description: 'TLS 인증서 (ALB·CloudFront)',
  category: 'security',
  icon: BadgeCheck,
  color: 'text-emerald-400',
  defaults: {
    domain_name: 'example.com',
    validation_method: 'DNS',
  },
  // Regional/global certificate — not inside a VPC, no traffic edges.
  allowedParents: ['canvas'],
  fields: [
    {
      key: 'domain_name',
      label: '도메인',
      type: 'text',
      required: true,
      placeholder: 'example.com',
      help: '와일드카드는 *.example.com 형식',
    },
    {
      key: 'validation_method',
      label: '검증 방식',
      type: 'select',
      options: [
        { value: 'DNS', label: 'DNS' },
        { value: 'EMAIL', label: '이메일' },
      ],
    },
  ],
  validate: (c) =>
    collect(
      validatePattern(
        c.domain_name,
        /^(\*\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
        '유효한 도메인을 입력하세요 (예: example.com).',
      ),
    ),
  terraform: ({ name, config, displayName }) => {
    const domain = typeof config.domain_name === 'string' && config.domain_name.trim()
      ? config.domain_name.trim()
      : 'example.com'
    const method = config.validation_method === 'EMAIL' ? 'EMAIL' : 'DNS'
    return `resource "aws_acm_certificate" "${name}" {
  domain_name       = "${domain}"
  validation_method = "${method}"
  lifecycle {
    create_before_destroy = true
  }
  tags = { Name = "${displayName}" }
}`
  },
}
