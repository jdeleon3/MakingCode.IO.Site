---
title: 'Securing a Contact Pipeline: Astro, Cloudflare Pages Functions, Turnstile, and n8n'
description: 'How we replaced hardcoded mailto links with an edge gateway that verifies humans, signs its own JWT, and hands off to a self-hosted n8n workflow — and the two local-dev gotchas that came with it.'
pubDate: 2026-07-08
tags: ['architecture', 'automation', 'security']
---

A `mailto:` link is not a contact pipeline — it's a hope that the visitor's OS has a mail client configured. Replacing it meant building something with an actual trust boundary: verify the submitter is human, authenticate the request before it touches internal infrastructure, and never let the browser talk to the automation server directly. Here's how that pipeline is put together.

## The shape of the problem

The site is static (Astro, `output: 'static'`), and the destination is a self-hosted n8n instance on a Hetzner VPC. Those two facts rule out the naive approach — a `<form>` posting straight to the n8n webhook URL — for two reasons: the webhook URL becomes public the moment it's in client-side JS, and there's nothing stopping a script from hammering it with junk submissions.

The fix is a broker in the middle: a Cloudflare Pages Function sitting at the edge, doing three things in strict order before anything reaches n8n.

```
Browser (Turnstile widget + form)
  → POST /api/submit-contact          (Cloudflare Pages Function)
      1. verify Turnstile token
      2. sign a short-lived JWT
      3. forward payload + JWT to n8n
  → n8n Webhook node (Hetzner VPC)     (JWT Auth credential checks the signature)
```

The browser never sees the n8n URL, never sees a credential, and can't reach the webhook without first clearing a human check.

## Turnstile as the gate, not the lock

The form embeds Cloudflare Turnstile as a widget scoped to the `ContactForm.astro` component rather than loaded globally, so pages without the form don't pay for it:

```html
<div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="dark"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

Because the widget lives inside a `<form>`, Turnstile auto-injects its response token into a hidden `cf-turnstile-response` field — no manual callback wiring needed. The client-side script just reads it out of `FormData` on submit and ships it alongside the form fields as JSON.

The verification itself happens server-side, in the Pages Function, against Cloudflare's `siteverify` endpoint:

```typescript
async function verifyTurnstile(token: string, secret: string, remoteIp: string | null): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
```

A client-side token is a hint, not proof — trusting the widget without this round trip would mean trusting whatever JavaScript happened to run in the visitor's browser.

## From OAuth to a self-signed JWT

The first cut of this pipeline authenticated to n8n with an OAuth 2.0 client-credentials grant: the Pages Function would exchange a client ID and secret at a token endpoint for a bearer token, then attach that token to the n8n request. It worked, but it bought more than the problem needed — a second network hop, a second point of failure, and an external token endpoint to keep alive, all to protect a single internal webhook that only one caller (this function) ever hits.

We replaced it with a self-signed HS256 JWT, minted inline using the Workers-native `SubtleCrypto` API — no token endpoint, no extra dependency, no extra round trip:

```typescript
async function signContactJwt(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'makingcode-contact-form',
    sub: 'contact-submission',
    iat: now,
    exp: now + 60, // single-use, short-lived
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
```

n8n's Webhook node verifies it on the way in with its built-in **JWT Auth** credential, checked against the same shared secret. The token is deliberately short-lived (60 seconds) and single-purpose — it exists only to prove "this request came from the contact function," not to carry a session or identity. That's a better fit for a single machine-to-machine hop than a full OAuth grant, and it removes an entire external dependency from the request path.

## Isolating two type universes

Adding `@cloudflare/workers-types` to get proper typing for the Pages Function (`PagesFunction<Env>`, the `crypto.subtle` global, etc.) initially broke an unrelated file. The cause: a `/// <reference types="@cloudflare/workers-types" />` directive doesn't scope itself to the file it's written in — it pulls the whole package into the *global* TypeScript program. Workers-types declares its own global `Element` interface (for `HTMLRewriter`), and its `append()` signature collided with the DOM lib's `Element.append()`, breaking type-checking in a component that had nothing to do with the contact form.

The fix was to stop merging the two globally. `functions/` got its own `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

...excluded from the root `tsconfig.json` (`"exclude": ["dist", "functions"]`), and checked as a separate step in the build:

```json
"build": "astro check && tsc --noEmit -p functions/tsconfig.json && astro build"
```

Astro's browser-facing code keeps the DOM lib it needs; the edge function keeps the Workers runtime types it needs. Neither program sees the other's globals.

## The local-dev trap: `astro dev` doesn't run Pages Functions

The first local test of the finished form failed with a 404 on `/api/submit-contact` — not a bug in the function, but a gap in how it was being served. `astro dev` is a plain Vite dev server; it only knows about routes under `src/pages/`. It has no concept of a `functions/` directory, so any request to `/api/*` simply has nowhere to go.

Cloudflare Pages Functions only run under Wrangler's Pages emulator (or in production, on Cloudflare itself). The fix was a dedicated script that builds the static site and serves it through that emulator instead:

```json
"pages:dev": "astro build && wrangler pages dev dist --env-file .env --compatibility-date=2026-07-07"
```

`wrangler pages dev` reads secrets straight from `.env`, wires up `functions/` alongside the static output, and serves both from one local server — the same shape the request will take in production. Plain `npm run dev` is still the right tool for fast UI iteration; it just can't be used to test the submission path itself.

## What's left on n8n's side

Everything up to the webhook is done and verified locally: Turnstile blocks non-human submissions, the Pages Function signs a short-lived JWT per request, and the request reaches n8n with that token in the `Authorization` header. The remaining piece is entirely on the n8n workflow — the Webhook node's JWT Auth credential needs the same HS256 secret configured, and whatever runs after it (CRM write, notification, whatever the workflow does with a new lead) is a normal n8n build from there.
