import { json } from '../_lib/http';
import { verifyTurnstile } from '../_lib/turnstile';
import { createOptInToken } from '../_lib/optin';
import { sendEmail } from '../_lib/resend';

interface Env {
  TURNSTILE_SECRET_KEY: string;
  JWT_SIGNING_SECRET: string;
  RESEND_API_KEY: string;
  /** Verified sender, e.g. `John DeLeon <posts@makingcode.io>`. */
  NEWSLETTER_FROM: string;
}

interface SubscribePayload {
  email: string;
  turnstileToken: string;
  /** Hidden field — legitimate visitors never fill this in. */
  website: string;
}

const MAX_EMAIL_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseSubscribePayload(body: unknown): SubscribePayload | null {
  if (!body || typeof body !== 'object') return null;
  const { email, turnstileToken, website } = body as Record<string, unknown>;

  if (typeof email !== 'string' || typeof turnstileToken !== 'string' || typeof website !== 'string') {
    return null;
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !turnstileToken) return null;
  if (trimmedEmail.length > MAX_EMAIL_LENGTH) return null;
  if (!EMAIL_PATTERN.test(trimmedEmail)) return null;

  return { email: trimmedEmail, turnstileToken, website };
}

function confirmationEmail(confirmUrl: string): { html: string; text: string } {
  const text = [
    'Confirm your email to get new MakingCode posts.',
    '',
    'Click this link and you are on the list:',
    confirmUrl,
    '',
    'The link expires in three days. If you did not enter your address on makingcode.io,',
    'ignore this — nothing was saved and no further email will be sent.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px 16px;background:#0a0b0d;color:#ece7dd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;line-height:1.6;">
  <div style="max-width:34rem;margin:0 auto;">
    <p style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#259ae8;margin:0 0 8px;">MakingCode</p>
    <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">Confirm your email to get new posts.</h1>
    <p style="margin:0 0 24px;color:#c9c4ba;">One click and you're on the list. New posts only — no separate newsletter content.</p>
    <p style="margin:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block;background:#259ae8;color:#0a0b0d;padding:12px 24px;text-decoration:none;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Confirm subscription</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#8d8d86;">The link expires in three days.</p>
    <p style="margin:0;font-size:13px;color:#8d8d86;">If you didn't enter your address on makingcode.io, ignore this. Nothing was saved and you won't hear from me again.</p>
  </div>
</body>
</html>`;

  return { html, text };
}

/**
 * Step one of double opt-in. Nothing is stored here — the address only reaches Resend once the
 * visitor clicks the signed link, so an unconfirmed subscribe leaves no record anywhere.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let payload: SubscribePayload | null;
  try {
    payload = parseSubscribePayload(await request.json());
  } catch {
    return json(400, { ok: false, error: 'Request body must be valid JSON.' });
  }

  if (!payload) {
    return json(400, { ok: false, error: 'Please enter a valid email address.' });
  }

  // Honeypot — same treatment as the comment form: look successful, write nothing.
  if (payload.website.trim() !== '') {
    console.warn('Honeypot triggered on newsletter subscribe — silently dropped.');
    return json(200, { ok: true });
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

  try {
    const token = await createOptInToken(payload.email, env.JWT_SIGNING_SECRET);
    const confirmUrl = new URL(`/api/newsletter-confirm?t=${encodeURIComponent(token)}`, request.url).toString();
    const { html, text } = confirmationEmail(confirmUrl);

    await sendEmail(env.RESEND_API_KEY, {
      from: env.NEWSLETTER_FROM,
      to: payload.email,
      subject: 'Confirm your email to get new MakingCode posts',
      html,
      text,
    });
  } catch (error) {
    console.error('Newsletter confirmation send error:', error);
    return json(502, { ok: false, error: 'Unable to send the confirmation email right now. Try again shortly.' });
  }

  // Deliberately identical for a new address and one already on the list — this endpoint should not
  // be usable to test whether a given address is subscribed.
  return json(200, { ok: true });
};
