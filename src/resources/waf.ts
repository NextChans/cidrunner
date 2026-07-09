import { ShieldCheck } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/**
 * WAF Web ACL — an OWASP / DDoS layer-7 filter for ALB / CloudFront (ADR 0035).
 * The emitter builds a REGIONAL web ACL with the AWS managed Common Rule Set
 * plus an IP rate-limit rule; it associates to a fronting service out of band,
 * so it declares no traffic edges (keeping the ALB a valid simulation entry
 * point). Self-contained and apply-ready on its own.
 */
export const waf: ResourceMeta = {
  type: 'waf',
  label: 'WAF Web ACL',
  description: 'OWASP·DDoS 방어 (L7 필터)',
  category: 'security',
  icon: ShieldCheck,
  color: 'text-red-400',
  defaults: {
    rate_limit: 2000,
    managed_common_rules: true,
  },
  // Account/region-level ACL — not inside a VPC, no traffic edges.
  allowedParents: ['canvas'],
  fields: [
    {
      key: 'rate_limit',
      label: '레이트 리밋 (5분당 IP)',
      type: 'number',
      min: 100,
      max: 2000000000,
      help: '5분 창에서 IP당 허용 요청 수를 초과하면 차단',
    },
    {
      key: 'managed_common_rules',
      label: 'AWS 공용 규칙셋',
      type: 'boolean',
      help: 'AWSManagedRulesCommonRuleSet (OWASP Top 10 대응)',
    },
  ],
  validate: (c) => collect(validateRange(c.rate_limit, 100, 2000000000, '레이트 리밋')),
  terraform: ({ name, awsName, config, displayName }) => {
    const rate = Number(config.rate_limit ?? 2000)
    const useCommon = config.managed_common_rules !== false
    const commonRule = useCommon
      ? `
  rule {
    name     = "common-rule-set"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${awsName}-common"
      sampled_requests_enabled   = true
    }
  }`
      : ''
    return `resource "aws_wafv2_web_acl" "${name}" {
  name  = "${awsName}"
  scope = "REGIONAL"
  default_action {
    allow {}
  }${commonRule}
  rule {
    name     = "rate-limit"
    priority = 2
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = ${rate}
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${awsName}-rate"
      sampled_requests_enabled   = true
    }
  }
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${awsName}"
    sampled_requests_enabled   = true
  }
  tags = { Name = "${displayName}" }
}`
  },
}
