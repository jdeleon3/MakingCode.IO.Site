const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * Identical implementation to the one that shipped inline in `submit-contact.ts` and
 * `submit-comment.ts`; extracted so the subscribe endpoint doesn't become a third copy.
 * Throws on network failure — callers decide whether that's a 502 or a silent pass.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp: string | null,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
