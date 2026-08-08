/**
 * Shared crypto helpers for Pages Functions.
 *
 * Lives under `_lib/` deliberately: every file under `functions/` becomes a route unless its
 * directory is underscore-prefixed. This is a module, not an endpoint.
 *
 * Extracted from the JWT signing that was private to `submit-contact.ts` — the contact form, the
 * comment `ip_hash`, and the newsletter double-opt-in tokens all need the same primitives.
 */

export function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacKey(secret: string, usages: ('sign' | 'verify')[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

/** HMAC-SHA256 over `data`, base64url-encoded. */
export async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(signature);
}

/**
 * Constant-time-ish signature check. `crypto.subtle.verify` does the comparison internally, which
 * avoids the timing leak of comparing base64 strings with `===`.
 */
export async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await hmacKey(secret, ['verify']);
    const padded = signature.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(signature.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

/**
 * Salted SHA-256 of a value that shouldn't be stored in the clear — currently the visitor's IP.
 * Returns null when there's nothing to hash, so callers can store NULL rather than a hash of "".
 */
export async function saltedHash(value: string | null, salt: string): Promise<string | null> {
  if (!value) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${value}`));
  return base64UrlEncode(digest);
}
