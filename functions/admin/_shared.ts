import { verifyAccessJwt, accessDenied } from '../_lib/access';

export interface AdminEnv {
  DB: D1Database;
  /** e.g. `yourteam.cloudflareaccess.com` — from Zero Trust → Settings → Custom Pages / team domain. */
  ACCESS_TEAM_DOMAIN: string;
  /** The Access application's AUD tag. */
  ACCESS_AUD: string;
  /**
   * Local-development escape hatch. Only honored when the request host is also localhost, so it
   * cannot open up the deployed site even if it were set there by mistake. Never set this in Pages.
   */
  ADMIN_DEV_BYPASS?: string;
}

/**
 * Gate for every `/admin` route. Returns a Response to send back on denial, or null to proceed.
 *
 * Cloudflare Access blocks unauthenticated requests before they reach these Functions; this check
 * exists so the routes still fail closed if that policy is ever removed or misconfigured.
 */
export async function requireAdmin(
  request: Request,
  env: AdminEnv,
): Promise<Response | null> {
  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocal && env.ADMIN_DEV_BYPASS === 'true') {
    console.warn('ADMIN_DEV_BYPASS active — Access verification skipped for local development.');
    return null;
  }

  const identity = await verifyAccessJwt(request, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
  if (!identity) return accessDenied();

  return null;
}

/** Escapes text for interpolation into the admin HTML. Comment bodies are untrusted input. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
