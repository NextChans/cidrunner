/**
 * UTF-8-safe base64url codec (ADR 0065). Shared by design sharing (`#g=`) and
 * custom-mission sharing (`#m=`) so both encode identically and stay
 * dependency-free. base64url (not plain base64) keeps the payload URL-fragment
 * safe: `+/=` become `-_` and stripped padding.
 */
export function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(packed: string): string | null {
  try {
    const b64 = packed.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}
