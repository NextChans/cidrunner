import { HardDrive } from 'lucide-react'
import type { ResourceMeta } from './types'

/** S3 — an object storage bucket. */
export const s3: ResourceMeta = {
  type: 's3',
  label: 'S3 Bucket',
  description: 'Object storage',
  icon: HardDrive,
  color: 'text-teal-400',
  defaults: {
    versioning: false,
  },
  // Phase 4: emit aws_s3_bucket HCL.
  terraform: () => '',
}
