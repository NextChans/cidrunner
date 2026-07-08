/**
 * Small, reusable config validators for `ResourceMeta.validate` (Phase 2).
 * Each returns a Korean error message, or `null` when the value is valid.
 */

/**
 * Validates an IPv4 CIDR block such as `10.0.0.0/16` against what AWS actually
 * accepts for VPC/Subnet CIDRs: /16–/28 prefix, and no host bits set (the
 * address must be the network base — AWS rejects `10.0.1.5/24`).
 */
export function validateCidr(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'CIDR 블록을 입력하세요.'
  }
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
  if (!match) return 'CIDR 형식이 올바르지 않습니다 (예: 10.0.0.0/16).'
  const octets = [match[1], match[2], match[3], match[4]].map(Number)
  if (octets.some((o) => o > 255)) return 'IP 옥텟은 0–255 범위여야 합니다.'
  const prefix = Number(match[5])
  if (prefix < 16 || prefix > 28) {
    return 'AWS VPC/Subnet 프리픽스는 /16–/28 범위여야 합니다.'
  }
  const ip =
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  const size = 2 ** (32 - prefix)
  const base = (ip & ~((size - 1) >>> 0)) >>> 0
  if (ip !== base) {
    const dotted = [base >>> 24, (base >>> 16) & 255, (base >>> 8) & 255, base & 255].join('.')
    return `호스트 비트가 설정되어 있습니다 — ${dotted}/${prefix}을(를) 사용하세요.`
  }
  return null
}

/** Validates that a numeric value falls within `[min, max]`. */
export function validateRange(
  value: unknown,
  min: number,
  max: number,
  label: string,
): string | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return `${label}은(는) 숫자여야 합니다.`
  if (n < min || n > max) return `${label}은(는) ${min}–${max} 범위여야 합니다.`
  return null
}

/** Validates a non-empty string, e.g. an EC2 AMI id or instance class. */
export function validatePattern(
  value: unknown,
  pattern: RegExp,
  message: string,
): string | null {
  if (typeof value !== 'string' || value.trim() === '') return message
  return pattern.test(value) ? null : message
}

/** Collects the non-null results of several checks into an error array. */
export function collect(...checks: (string | null)[]): string[] {
  return checks.filter((c): c is string => c !== null)
}
