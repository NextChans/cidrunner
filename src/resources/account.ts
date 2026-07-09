import { Building2 } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * AWS Account — an organizational boundary that groups VPCs (and, visually, the
 * architecture that belongs to one account). It is a *container* but emits no
 * Terraform of its own: an account maps to the provider's credentials/context,
 * not to a resource (ADR 0050). Children (VPCs) render inside its box.
 */
export const account: ResourceMeta = {
  type: 'account',
  label: 'AWS Account',
  description: '계정 경계 — VPC 그룹',
  category: 'network',
  icon: Building2,
  color: 'text-teal-300',
  defaults: {
    account_id: '123456789012',
  },
  // Outermost organizational boundary — sits at the top level.
  allowedParents: ['canvas'],
  container: true,
  defaultSize: { width: 660, height: 520 },
  fields: [
    {
      key: 'account_id',
      label: '계정 ID',
      type: 'text',
      placeholder: '123456789012',
      help: '조직용 표시값입니다 (Terraform 리소스로 생성되지 않습니다).',
    },
  ],
  // Only flag a non-empty value that is not a 12-digit account id.
  validate: (c) =>
    typeof c.account_id === 'string' && c.account_id.trim() !== '' && !/^\d{12}$/.test(c.account_id)
      ? ['AWS 계정 ID는 12자리 숫자입니다.']
      : [],
  // Organizational only — no HCL resource (ADR 0050).
  terraform: () => '',
}
