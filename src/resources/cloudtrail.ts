import { ScrollText } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * CloudTrail (ADR 0062) — account-level API audit logging. A trail delivers log
 * files to an S3 bucket: draw a `cloudtrail → s3` edge to pick the destination.
 * The generator also emits the S3 bucket policy CloudTrail needs to write
 * (derived plumbing, like route tables). Log delivery is not request traffic, so
 * the edge is excluded from the simulation.
 */
export const cloudtrail: ResourceMeta = {
  type: 'cloudtrail',
  label: 'CloudTrail',
  description: '계정 API 감사 로깅',
  category: 'management',
  icon: ScrollText,
  color: 'text-emerald-400',
  defaults: {
    multi_region: true,
    log_file_validation: true,
  },
  allowedParents: ['canvas'],
  connectsTo: ['s3'],
  fields: [
    { key: 'multi_region', label: '멀티 리전 추적', type: 'boolean' },
    {
      key: 'log_file_validation',
      label: '로그 파일 무결성 검증',
      type: 'boolean',
      help: '로그 파일 변조를 탐지할 수 있는 해시 체인을 생성합니다.',
    },
  ],
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const bucket = refs.logBucket ?? 'REPLACE_ME'
    return `resource "aws_cloudtrail" "${name}" {
  name                          = "${awsName}"
  s3_bucket_name                = aws_s3_bucket.${bucket}.id
  is_multi_region_trail         = ${config.multi_region !== false}
  enable_log_file_validation    = ${config.log_file_validation !== false}
  include_global_service_events = true
  depends_on                    = [aws_s3_bucket_policy.${name}_bucket_policy]
  tags = { Name = "${displayName}" }
}`
  },
}
