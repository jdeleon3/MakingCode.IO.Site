import { createClient } from '@supabase/supabase-js';

interface Env {
  TURNSTILE_SECRET_KEY: string;
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
}

interface CommentPayload {
  postSlug: string;
  authorName: string;
  authorEmail: string;
  body: string;
  turnstileToken: string;
  /** Hidden field — legitimate visitors never fill this in. */
  website: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 200;
const MAX_BODY_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function parseCommentPayload(body: unknown): CommentPayload | null {
  if (!body || typeof body !== 'object') return null;
  const { postSlug, authorName, authorEmail, body: message, turnstileToken, website } =
    body as Record<string, unknown>;

  if (
    typeof postSlug !== 'string' ||
    typeof authorName !== 'string' ||
    typeof authorEmail !== 'string' ||
    typeof message !== 'string' ||
    typeof turnstileToken !== 'string' ||
    typeof website !== 'string'
  ) {
    return null;
  }

  const trimmedSlug = postSlug.trim();
  const trimmedName = authorName.trim();
  const trimmedEmail = authorEmail.trim();
  const trimmedBody = message.trim();

  if (!trimmedSlug || !trimmedName || !trimmedEmail || !trimmedBody || !turnstileToken) return null;
  if (trimmedName.length > MAX_NAME_LENGTH) return null;
  if (trimmedEmail.length > MAX_EMAIL_LENGTH) return null;
  if (trimmedBody.length > MAX_BODY_LENGTH) return null;
  if (!EMAIL_PATTERN.test(trimmedEmail)) return null;

  return {
    postSlug: trimmedSlug,
    authorName: trimmedName,
    authorEmail: trimmedEmail,
    body: trimmedBody,
    turnstileToken,
    website,
  };
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let payload: CommentPayload | null;
  try {
    const body = await request.json();
    payload = parseCommentPayload(body);
  } catch {
    return json(400, { ok: false, error: 'Request body must be valid JSON.' });
  }

  if (!payload) {
    return json(400, { ok: false, error: 'Missing or invalid comment fields.' });
  }

  // Honeypot: a real visitor never fills in the hidden "website" field. Bots that
  // auto-fill every input do. Report success without writing anything, so the bot
  // gets no signal that it was caught.
  if (payload.website.trim() !== '') {
    console.warn('Honeypot triggered on comment submission — silently dropped.');
    return json(200, { ok: true, status: 'pending' });
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

  const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);

  const { error: insertError } = await supabase.from('comments').insert({
    post_slug: payload.postSlug,
    author_name: payload.authorName,
    author_email: payload.authorEmail,
    body: payload.body,
    status: 'pending',
  });

  if (insertError) {
    console.error('Supabase comment insert error:', insertError.message);
    return json(502, { ok: false, error: 'Unable to save your comment at this time.' });
  }

  return json(200, { ok: true, status: 'pending' });
};
