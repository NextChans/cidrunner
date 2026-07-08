import { HardDrive } from 'lucide-react'
import type { ResourceMeta } from './types'

/** S3 — an object storage bucket, secure by default. */
export const s3: ResourceMeta = {
  type: 's3',
  label: 'S3 Bucket',
  description: '오브젝트 스토리지',
  category: 'storage',
  icon: HardDrive,
  color: 'text-teal-400',
  defaults: {
    versioning: false,
    encryption: true,
    block_public_access: true,
  },
  // A regional bucket — not inside a VPC.
  allowedParents: ['canvas'],
  fields: [
    { key: 'versioning', label: '버저닝 활성화', type: 'boolean', help: '객체의 이전 버전을 보관' },
    {
      key: 'encryption',
      label: '기본 암호화 (SSE-S3)',
      type: 'boolean',
      help: '끄면 보안 경고가 발생합니다',
    },
    {
      key: 'block_public_access',
      label: '퍼블릭 액세스 차단',
      type: 'boolean',
      help: '끄면 보안 경고가 발생합니다',
    },
  ],
  terraform: ({ name, awsName, config, displayName }) => {
    const blocks = [
      `resource "aws_s3_bucket" "${name}" {
  bucket_prefix = "${awsName.toLowerCase()}-"
  tags = { Name = "${displayName}" }
}`,
    ]
    if (config.versioning) {
      blocks.push(`resource "aws_s3_bucket_versioning" "${name}_versioning" {
  bucket = aws_s3_bucket.${name}.id
  versioning_configuration {
    status = "Enabled"
  }
}`)
    }
    if (config.encryption !== false) {
      blocks.push(`resource "aws_s3_bucket_server_side_encryption_configuration" "${name}_sse" {
  bucket = aws_s3_bucket.${name}.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}`)
    }
    if (config.block_public_access !== false) {
      blocks.push(`resource "aws_s3_bucket_public_access_block" "${name}_pab" {
  bucket                  = aws_s3_bucket.${name}.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`)
    }
    return blocks.join('\n\n')
  },
}
