import { Compass } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validatePattern } from './validators'

/**
 * Route 53 — a hosted zone with an A-alias record pointing at CloudFront or
 * an ALB (route53 → target edge). The topmost entry of a request's journey.
 */
export const route53: ResourceMeta = {
  type: 'route53',
  label: 'Route 53',
  description: 'DNS — 요청 여정의 시작',
  category: 'network',
  icon: Compass,
  color: 'text-lime-400',
  defaults: {
    domain_name: 'example.com',
  },
  // Global service — not inside a VPC.
  allowedParents: ['canvas'],
  connectsTo: ['cloudfront', 'alb'],
  fields: [
    {
      key: 'domain_name',
      label: '도메인 이름',
      type: 'text',
      required: true,
      placeholder: 'example.com',
    },
  ],
  validate: (c) =>
    collect(
      validatePattern(
        c.domain_name,
        /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i,
        '도메인 형식이 올바르지 않습니다 (예: example.com).',
      ),
    ),
  terraform: ({ name, config, refs }) => {
    const domain = String(config.domain_name ?? 'example.com')
    const zone = `resource "aws_route53_zone" "${name}" {
  name = "${domain}"
}`
    const target = refs.aliasTarget
    if (!target) return zone
    const aliasName =
      target.kind === 'cloudfront'
        ? `aws_cloudfront_distribution.${target.name}.domain_name`
        : `aws_lb.${target.name}.dns_name`
    const aliasZone =
      target.kind === 'cloudfront'
        ? `aws_cloudfront_distribution.${target.name}.hosted_zone_id`
        : `aws_lb.${target.name}.zone_id`
    return `${zone}

resource "aws_route53_record" "${name}_alias" {
  zone_id = aws_route53_zone.${name}.zone_id
  name    = "${domain}"
  type    = "A"
  alias {
    name                   = ${aliasName}
    zone_id                = ${aliasZone}
    evaluate_target_health = false
  }
}`
  },
}
