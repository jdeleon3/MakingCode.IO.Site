interface Env {
  TURNSTILE_SECRET_KEY: string;
  JWT_SIGNING_SECRET: string;
  N8N_WEBHOOK_URL: string;
}

interface ContactPayload {
  name: string;
  email: string;
  message: string;
  turnstileToken: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_FIELD_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function parseContactPayload(body: unknown): ContactPayload | null {
  if (!body || typeof body !== 'object') return null;
  const { name, email, message, turnstileToken } = body as Record<string, unknown>;

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof message !== 'string' ||
    typeof turnstileToken !== 'string'
  ) {
    return null;
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();

  if (!trimmedName || !trimmedEmail || !trimmedMessage || !turnstileToken) return null;
  if (
    trimmedName.length > MAX_FIELD_LENGTH ||
    trimmedEmail.length > MAX_FIELD_LENGTH ||
    trimmedMessage.length > MAX_FIELD_LENGTH
  ) {
    return null;
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) return null;

  return { name: trimmedName, email: trimmedEmail, message: trimmedMessage, turnstileToken };
}

async function verifyTurnstile(token: string, secret: string, remoteIp: string | null): Promise<boolean> {
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

const JWT_TTL_SECONDS = 60;

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signContactJwt(secret: string): Promise<string> {
  if (!secret) throw new Error('JWT_SIGNING_SECRET is not configured');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'makingcode-contact-form',
    sub: 'contact-submission',
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function forwardToN8n(env: Env, jwt: string, payload: ContactPayload): Promise<void> {
  const response = await fetch(env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      message: payload.message,
      submittedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`n8n webhook rejected the submission with status ${response.status}`);
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let payload: ContactPayload | null;
  try {
    const body = await request.json();
    payload = parseContactPayload(body);
  } catch {
    return json(400, { ok: false, error: 'Request body must be valid JSON.' });
  }

  if (!payload) {
    return json(400, { ok: false, error: 'Missing or invalid name, email, message, or turnstileToken.' });
  }

  try {
    const remoteIp = request.headers.get('CF-Connecting-IP');
    const isHuman = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET_KEY, remoteIp);
    if (!isHuman) {
      return json(400, { ok: false, error: 'Human verification failed. Please try again.' });
    }
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return json(502, { ok: false, error: 'Unable to verify human validation at this time.' });
  }

  let jwt: string;
  try {
    jwt = await signContactJwt(env.JWT_SIGNING_SECRET);
  } catch (error) {
    console.error('JWT signing error:', error);
    return json(500, { ok: false, error: 'Unable to authenticate the submission.' });
  }

  try {
    await forwardToN8n(env, jwt, payload);
  } catch (error) {
    console.error('n8n webhook delivery error:', error);
    return json(502, { ok: false, error: 'Unable to deliver your submission at this time.' });
  }

  return json(200, { ok: true });
};
