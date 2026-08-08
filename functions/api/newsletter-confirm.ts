import { readOptInToken } from '../_lib/optin';
import { addContact } from '../_lib/resend';

interface Env {
  JWT_SIGNING_SECRET: string;
  RESEND_API_KEY: string;
  /** Resend renamed Audiences to Segments — this is the id of that list. */
  RESEND_SEGMENT_ID: string;
}

const redirect = (path: string, requestUrl: string) =>
  new Response(null, {
    status: 302,
    headers: {
      location: new URL(path, requestUrl).toString(),
      'cache-control': 'no-store',
    },
  });

/**
 * Step two of double opt-in: the signed link from the confirmation email lands here.
 *
 * This is the only place a subscriber is written anywhere, and it happens after the visitor proves
 * control of the address. Re-clicking a still-valid link is idempotent as far as the visitor can
 * tell: `addContact` swallows the duplicate-contact conflict and they land on the same page.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const email = await readOptInToken(token, env.JWT_SIGNING_SECRET);

  if (!email) {
    return redirect('/newsletter/invalid/', request.url);
  }

  try {
    await addContact(env.RESEND_API_KEY, env.RESEND_SEGMENT_ID, email);
  } catch (error) {
    console.error('Resend contact create error:', error);
    return redirect('/newsletter/invalid/', request.url);
  }

  return redirect('/newsletter/confirmed/', request.url);
};
