import { Layers } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * Availability Zone — an organizational box inside a VPC that groups the Subnets
 * living in one AZ. It emits no Terraform of its own (an AZ is a *property* of a
 * subnet, not a resource — ADR 0050); instead, a Subnet created inside an AZ box
 * inherits the box's `az` as its default (still editable in the Inspector).
 */
export const az: ResourceMeta = {
  type: 'az',
  label: 'Availability Zone',
  description: 'AZ 경계 — Subnet 그룹',
  category: 'network',
  icon: Layers,
  color: 'text-sky-300',
  defaults: {
    az: 'a',
  },
  // Lives inside a VPC; holds subnets.
  allowedParents: ['vpc'],
  container: true,
  defaultSize: { width: 400, height: 280 },
  fields: [
    {
      key: 'az',
      label: '가용 영역 (AZ)',
      type: 'select',
      options: [
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
        { value: 'c', label: 'c' },
        { value: 'd', label: 'd' },
      ],
      help: '이 박스 안에 만든 Subnet은 이 AZ를 기본값으로 물려받습니다.',
    },
  ],
  // Organizational only — the AZ is reflected on the subnets inside it (ADR 0050).
  terraform: () => '',
}
