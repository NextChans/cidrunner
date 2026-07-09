import { UserCheck } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/**
 * Cognito User Pool — a managed user directory for app sign-up / sign-in
 * (ADR 0035). Regional, account-level identity service: it sits on the canvas
 * on its own and does not carry request traffic, so it declares no edges — a
 * web tier authenticates against it out of band. The emitter ships a working
 * user pool plus an app client so `terraform apply` yields a usable pool.
 */
export const cognito: ResourceMeta = {
  type: 'cognito',
  label: 'Cognito User Pool',
  description: '앱 사용자 인증·회원 관리',
  category: 'security',
  icon: UserCheck,
  color: 'text-sky-400',
  defaults: {
    mfa: 'OFF',
    password_min_length: 8,
    email_verification: true,
  },
  // Regional identity service — not inside a VPC. Draw an edge cognito → apigw
  // to make it the API's authorizer (attachment, not traffic — ADR 0056): the
  // API Gateway then guards its methods with a COGNITO_USER_POOLS authorizer
  // instead of `authorization = "NONE"`.
  allowedParents: ['canvas'],
  connectsTo: ['apigw'],
  fields: [
    {
      key: 'mfa',
      label: 'MFA',
      type: 'select',
      options: [
        { value: 'OFF', label: '사용 안 함' },
        { value: 'OPTIONAL', label: '선택' },
        { value: 'ON', label: '필수' },
      ],
      help: '다단계 인증 정책',
    },
    {
      key: 'password_min_length',
      label: '비밀번호 최소 길이',
      type: 'number',
      min: 6,
      max: 99,
    },
    {
      key: 'email_verification',
      label: '이메일 자동 검증',
      type: 'boolean',
      help: '가입 시 이메일 소유를 확인합니다',
    },
  ],
  validate: (c) => collect(validateRange(c.password_min_length, 6, 99, '비밀번호 최소 길이')),
  terraform: ({ name, awsName, config, displayName }) => {
    const mfa = typeof config.mfa === 'string' ? config.mfa : 'OFF'
    const minLen = Number(config.password_min_length ?? 8)
    const verifyEmail = config.email_verification !== false
    const mfaBlock =
      mfa === 'OFF'
        ? ''
        : `
  software_token_mfa_configuration {
    enabled = true
  }`
    const verifyLine = verifyEmail ? '\n  auto_verified_attributes = ["email"]' : ''
    return `resource "aws_cognito_user_pool" "${name}" {
  name              = "${awsName}"
  mfa_configuration = "${mfa}"${verifyLine}
  password_policy {
    minimum_length    = ${minLen}
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }${mfaBlock}
  tags = { Name = "${displayName}" }
}

resource "aws_cognito_user_pool_client" "${name}_client" {
  name            = "${awsName}-client"
  user_pool_id    = aws_cognito_user_pool.${name}.id
  generate_secret = false
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]
}`
  },
}
