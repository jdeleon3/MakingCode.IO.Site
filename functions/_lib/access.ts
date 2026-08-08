import { base64UrlDecode } from './crypto';

/**
 * Cloudflare Access JWT verification for the `/admin` routes.
 *
 * Access is the real gate: it authenticates at the edge and never forwards an unauthenticated
 * request to these Functions at all. This module is defense in depth — if the Access application
 * is ever deleted, its policy loosened, or its path pattern edited so `/admin` falls outside it,
 * these routes fail closed instead of quietly becoming a public comment-moderation panel.
 *
 * Access signs the assertion with RS256 and publishes its keys at the team domain's JWKS endpoint.
 */

interface AccessJwtPayload {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

export interface AccessIdentity {
  email: string;
}

/**
 * Accepts the team domain in any of the shapes it gets copied out of the dashboard —
 * `team.cloudflareaccess.com`, `https://team.cloudflareaccess.com`, or either with a trailing
 * slash. Getting this wrong otherwise fails closed with a bare 403 and no hint as to why.
 */
function normalizeTeamDomain(value: string): string {
  return value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/** JWKS changes rarely; cache per isolate so we aren't fetching certs on every page load. */
let cachedKeys: { teamDomain: string; fetchedAt: number; keys: Jwk[] } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getSigningKeys(teamDomain: string): Promise<Jwk[]> {
  const fresh = cachedKeys && cachedKeys.teamDomain === teamDomain && Date.now() - cachedKeys.fetchedAt < JWKS_TTL_MS;
  if (fresh && cachedKeys) return cachedKeys.keys;

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access JWKS fetch failed with status ${response.status}`);

  const { keys } = (await response.json()) as { keys?: Jwk[] };
  if (!keys?.length) throw new Error('Access JWKS returned no keys');

  cachedKeys = { teamDomain, fetchedAt: Date.now(), keys };
  return keys;
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/**
 * Returns the verified identity, or null if the assertion is missing, malformed, expired, signed by
 * an unknown key, or issued for a different application.
 */
export async function verifyAccessJwt(
  request: Request,
  rawTeamDomain: string,
  expectedAud: string,
): Promise<AccessIdentity | null> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !rawTeamDomain || !expectedAud) return null;

  const teamDomain = normalizeTeamDomain(rawTeamDomain);
  const expectedAudTag = expectedAud.trim();

  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) return null;

  let payload: AccessJwtPayload;
  let kid: string | undefined;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart)) as AccessJwtPayload;
    kid = (JSON.parse(base64UrlDecode(headerPart)) as { kid?: string }).kid;
  } catch {
    return null;
  }

  if (!kid) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  if (!payload.exp || payload.exp * 1000 <= Date.now()) return null;

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(expectedAudTag)) return null;

  let keys: Jwk[];
  try {
    keys = await getSigningKeys(teamDomain);
  } catch (error) {
    console.error('Access JWKS error:', error);
    return null;
  }

  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );

    return verified ? { email: payload.email ?? 'unknown' } : null;
  } catch (error) {
    console.error('Access JWT verification error:', error);
    return null;
  }
}

export const accessDenied = () =>
  new Response('Forbidden — this page is protected by Cloudflare Access.', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
