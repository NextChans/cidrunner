import { Cloud } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * CloudFront — a CDN in front of an origin (ALB, S3, or an API Gateway). A
 * cloudfront → origin edge selects the origin; without one the emitter falls
 * back to a placeholder domain (and validation raises an error). Since the
 * Lambda + API GW split (ADR 0046), a serverless origin is the API Gateway
 * block rather than a bare Lambda.
 */
export const cloudfront: ResourceMeta = {
  type: 'cloudfront',
  label: 'CloudFront',
  description: 'CDN — 오리진(ALB/S3/API GW) 앞단',
  category: 'network',
  icon: Cloud,
  color: 'text-cyan-400',
  defaults: {
    price_class: 'PriceClass_200',
  },
  // Global service — not inside a VPC.
  allowedParents: ['canvas'],
  connectsTo: ['alb', 's3', 'apigw'],
  fields: [
    {
      key: 'price_class',
      label: '가격 클래스',
      type: 'select',
      options: [
        { value: 'PriceClass_100', label: '100 (북미·유럽)' },
        { value: 'PriceClass_200', label: '200 (+아시아)' },
        { value: 'PriceClass_All', label: 'All (전 엣지)' },
      ],
    },
  ],
  terraform: ({ name, config, refs, displayName }) => {
    const origin = refs.originTarget
    let originBlock: string
    let extra = ''
    if (origin?.kind === 's3') {
      extra = `resource "aws_cloudfront_origin_access_identity" "${name}_oai" {
  comment = "cidrunner: ${displayName}"
}

`
      originBlock = `  origin {
    domain_name = aws_s3_bucket.${origin.name}.bucket_regional_domain_name
    origin_id   = "origin-${origin.name}"
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.${name}_oai.cloudfront_access_identity_path
    }
  }`
    } else {
      const isApi = origin?.kind === 'apigw'
      const domain = isApi
        ? `"\${aws_api_gateway_rest_api.${origin.name}.id}.execute-api.\${var.aws_region}.amazonaws.com"`
        : origin?.kind === 'alb'
          ? `aws_lb.${origin.name}.dns_name`
          : `"origin-not-connected.example.com"`
      // A REST API is reached under its stage path, so a CloudFront API origin
      // needs an origin_path of "/<stage>".
      const originPath = isApi
        ? `\n    origin_path = "/\${aws_api_gateway_stage.${origin.name}.stage_name}"`
        : ''
      originBlock = `  origin {
    domain_name = ${domain}
    origin_id   = "origin-${origin?.name ?? 'missing'}"${originPath}
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "${isApi ? 'https-only' : 'http-only'}"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }`
    }
    return `${extra}resource "aws_cloudfront_distribution" "${name}" {
  enabled     = true
  price_class = "${config.price_class ?? 'PriceClass_200'}"${origin?.kind === 's3' ? '\n  default_root_object = "index.html"' : ''}

${originBlock}

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "origin-${origin?.name ?? 'missing'}"
    viewer_protocol_policy = "redirect-to-https"
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${displayName}" }
}`
  },
}
