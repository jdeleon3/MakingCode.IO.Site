/**
 * Minimal Resend REST client — two calls, no SDK.
 *
 * The official `resend` npm package pulls in a React-email dependency tree that buys nothing here:
 * these are two `fetch` calls against a stable API, in a Workers runtime where bundle size is the
 * cold-start cost.
 */

const RESEND_API = 'https://api.resend.com';

interface SendEmailInput {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/** Thrown for any non-2xx Resend response. `status` lets callers treat specific codes as benign. */
export class ResendError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ResendError';
  }
}

async function resendRequest(path: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${RESEND_API}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; name?: string };

  if (!response.ok) {
    throw new ResendError(
      response.status,
      `Resend ${path} failed (${response.status}): ${payload.message ?? payload.name ?? 'unknown error'}`,
    );
  }

  return payload;
}

export async function sendEmail(apiKey: string, input: SendEmailInput): Promise<void> {
  await resendRequest('/emails', apiKey, {
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    reply_to: input.replyTo,
  });
}

/**
 * Adds a confirmed subscriber to the mailing list.
 *
 * Resend renamed Audiences to Segments; the current API is `POST /contacts` with a `segments` array,
 * and `RESEND_SEGMENT_ID` is the id of the list shown in the dashboard.
 *
 * A 409 is swallowed: someone clicking their confirmation link twice, or resubscribing an address
 * that's already on the list, should see success rather than an error page. Every other failure
 * propagates.
 */
export async function addContact(apiKey: string, segmentId: string, email: string): Promise<void> {
  try {
    await resendRequest('/contacts', apiKey, {
      email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    });
  } catch (error) {
    if (error instanceof ResendError && error.status === 409) return;
    throw error;
  }
}
