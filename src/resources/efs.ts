import { FolderTree } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * EFS — an elastic file system shared across instances in a VPC (ADR 0026).
 * The file system is regional; access comes from a mount target per AZ (a
 * mount target is unique per AZ, so we emit one per distinct-AZ subnet). EC2
 * mounts it as a shared volume, so it acts as a storage sink in the simulation.
 */
export const efs: ResourceMeta = {
  type: 'efs',
  label: 'EFS',
  description: '공유 파일 시스템 (다중 인스턴스)',
  category: 'storage',
  icon: FolderTree,
  color: 'text-green-400',
  defaults: {
    encrypted: true,
    performance_mode: 'generalPurpose',
  },
  // Mount targets live in the VPC's subnets; place the block inside the VPC.
  allowedParents: ['vpc'],
  fields: [
    {
      key: 'encrypted',
      label: '저장 데이터 암호화',
      type: 'boolean',
      help: '끄면 보안 경고가 발생합니다',
    },
    {
      key: 'performance_mode',
      label: '성능 모드',
      type: 'select',
      options: [
        { value: 'generalPurpose', label: '범용 (General Purpose)' },
        { value: 'maxIO', label: 'Max I/O' },
      ],
    },
  ],
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const sgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`)
    const sgLine = sgs.length ? `\n  security_groups = [${sgs.join(', ')}]` : ''
    // One mount target per AZ (mount targets are unique per AZ).
    const mounts = (refs.azUniqueSubnets ?? [])
      .map(
        (s) => `

resource "aws_efs_mount_target" "${name}_${s}" {
  file_system_id  = aws_efs_file_system.${name}.id
  subnet_id       = aws_subnet.${s}.id${sgLine}
}`,
      )
      .join('')
    return `resource "aws_efs_file_system" "${name}" {
  creation_token   = "${awsName}"
  encrypted        = ${config.encrypted === false ? 'false' : 'true'}
  performance_mode = "${config.performance_mode === 'maxIO' ? 'maxIO' : 'generalPurpose'}"
  tags = { Name = "${displayName}" }
}${mounts}`
  },
}
