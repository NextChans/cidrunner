import { HardDrive } from 'lucide-react'
import type { ResourceMeta } from './types'

/** S3 — an object storage bucket. */
export const s3: ResourceMeta = {
  type: 's3',
  label: 'S3 Bucket',
  description: '오브젝트 스토리지',
  icon: HardDrive,
  color: 'text-teal-400',
  defaults: {
    versioning: false,
  },
  // A regional bucket — not inside a VPC.
  allowedParents: ['canvas'],
  fields: [
    { key: 'versioning', label: '버저닝 활성화', type: 'boolean', help: '객체의 이전 버전을 보관' },
  ],
  // Phase 4: emit aws_s3_bucket HCL.
  terraform: () => '',
}
