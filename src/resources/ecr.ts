import { Package } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * Elastic Container Registry (ADR 0062) — stores the container images ECS/EKS
 * pull. A regional service (not in a VPC); draw an `ecr → ecs|eks` edge to show
 * which workloads pull from it. The image pull is not request traffic, so the
 * edge is excluded from the simulation (like a CloudWatch monitoring link).
 */
export const ecr: ResourceMeta = {
  type: 'ecr',
  label: 'ECR',
  description: '컨테이너 이미지 레지스트리',
  category: 'storage',
  icon: Package,
  color: 'text-sky-400',
  defaults: {
    scan_on_push: true,
    image_tag_mutability: 'IMMUTABLE',
  },
  allowedParents: ['canvas'],
  connectsTo: ['ecs', 'eks'],
  fields: [
    { key: 'scan_on_push', label: '푸시 시 취약점 스캔', type: 'boolean' },
    {
      key: 'image_tag_mutability',
      label: '이미지 태그',
      type: 'select',
      options: [
        { value: 'IMMUTABLE', label: '불변 (IMMUTABLE)' },
        { value: 'MUTABLE', label: '가변 (MUTABLE)' },
      ],
      help: '불변 태그는 같은 태그 재푸시를 막아 공급망 무결성을 지킵니다.',
    },
  ],
  terraform: ({ name, awsName, config, displayName }) => {
    const mutability = config.image_tag_mutability === 'MUTABLE' ? 'MUTABLE' : 'IMMUTABLE'
    return `resource "aws_ecr_repository" "${name}" {
  name                 = "${awsName.toLowerCase()}"
  image_tag_mutability = "${mutability}"
  image_scanning_configuration {
    scan_on_push = ${config.scan_on_push !== false}
  }
  tags = { Name = "${displayName}" }
}`
  },
}
