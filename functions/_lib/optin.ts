import { base64UrlEncode, base64UrlDecode, hmacSign, hmacVerify } from './crypto';

/**
 * Stateless double opt-in tokens.
 *
 * There is no pending-subscriber table anywhere. The confirmation link carries the address and an
 * expiry, signed with `JWT_SIGNING_SECRET`; the Resend contact is created only when that link is
 * clicked. An address that never confirms leaves no trace at all — nothing to store, nothing to
 * clean up, and no unconfirmed addresses sitting in the sending list dragging down deliverability.
 *
 * The token is single-purpose (`sub` is fixed) so a signature minted here can't be replayed against
 * the contact form's JWT, which shares the same secret.
 */

const TOKEN_PURPOSE = 'newsletter-optin';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3;

interface TokenClaims {
  sub: string;
  email: string;
  exp: number;
}

export async function createOptInToken(email: string, secret: string): Promise<string> {
  const claims: TokenClaims = {
    sub: TOKEN_PURPOSE,
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  return `${payload}.${await hmacSign(payload, secret)}`;
}

/** Returns the confirmed email address, or null if the token is malformed, forged, or expired. */
export async function readOptInToken(token: string, secret: string): Promise<string | null> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  if (!(await hmacVerify(payload, signature, secret))) return null;

  let claims: TokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payload)) as TokenClaims;
  } catch {
    return null;
  }

  if (claims.sub !== TOKEN_PURPOSE) return null;
  if (!claims.email || typeof claims.exp !== 'number') return null;
  if (claims.exp * 1000 <= Date.now()) return null;

  return claims.email;
}
