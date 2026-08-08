import { json } from '../_lib/http';
import { verifyTurnstile } from '../_lib/turnstile';
import { saltedHash } from '../_lib/crypto';
import { sendEmail } from '../_lib/resend';

interface Env {
  TURNSTILE_SECRET_KEY: string;
  /** Salt for `ip_hash`. Reuses the contact form's secret rather than minting another one. */
  JWT_SIGNING_SECRET: string;
  DB: D1Database;
  /** Optional — when all three are set, a new pending comment pings you instead of waiting to be found. */
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM?: string;
  COMMENT_NOTIFY_TO?: string;
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

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 200;
const MAX_BODY_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tells me a comment is waiting, so moderation is a push rather than something I remember to check.
 * Best-effort by design — a Resend outage must never cost a visitor their comment, so this is called
 * through `waitUntil` after the row is already committed and every failure is swallowed to the log.
 */
async function notifyModerator(env: Env, payload: CommentPayload): Promise<void> {
  if (!env.RESEND_API_KEY || !env.NEWSLETTER_FROM || !env.COMMENT_NOTIFY_TO) return;

  try {
    await sendEmail(env.RESEND_API_KEY, {
      from: env.NEWSLETTER_FROM,
      to: env.COMMENT_NOTIFY_TO,
      replyTo: payload.authorEmail,
      subject: `Comment pending on ${payload.postSlug}`,
      text: `${payload.authorName} <${payload.authorEmail}> on ${payload.postSlug}:\n\n${payload.body}\n\nModerate: https://makingcode.io/admin`,
      html: `<p style="font-family:ui-monospace,monospace;font-size:12px;color:#8d8d86;">${escapeHtml(payload.authorName)} &lt;${escapeHtml(payload.authorEmail)}&gt; on <strong>${escapeHtml(payload.postSlug)}</strong></p>
<blockquote style="border-left:2px solid #259ae8;margin:16px 0;padding-left:16px;white-space:pre-wrap;">${escapeHtml(payload.body)}</blockquote>
<p><a href="https://makingcode.io/admin">Approve or reject &rarr;</a></p>`,
    });
  } catch (error) {
    console.error('Comment notification send error:', error);
  }
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

  const remoteIp = request.headers.get('CF-Connecting-IP');

  try {
    const isHuman = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET_KEY, remoteIp);
    if (!isHuman) {
      return json(400, { ok: false, error: 'Human verification failed. Please try again.' });
    }
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return json(502, { ok: false, error: 'Unable to verify human validation at this time.' });
  }

  try {
    // `status` is hard-coded here rather than taken from input. The Postgres original enforced the
    // same thing through an RLS WITH CHECK policy; with D1 there is no public client, so this
    // Function is the only writer and the literal is the enforcement.
    await env.DB.prepare(
      `insert into comments (id, post_slug, author_name, author_email, body, status, ip_hash, created_at)
       values (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        payload.postSlug,
        payload.authorName,
        payload.authorEmail,
        payload.body,
        await saltedHash(remoteIp, env.JWT_SIGNING_SECRET),
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    console.error('D1 comment insert error:', error);
    return json(502, { ok: false, error: 'Unable to save your comment at this time.' });
  }

  context.waitUntil(notifyModerator(env, payload));

  return json(200, { ok: true, status: 'pending' });
};
