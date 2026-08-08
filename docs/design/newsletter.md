# Newsletter — Technical Design

Email delivery of new posts, added 2026-08-08 alongside the RSS rebuild and the D1 migration.

The site had no way for a reader to hear about a new post except checking back. RSS covers the
readers who already run a feed reader; this covers the ones who don't.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Subscriber storage | Resend Segments (formerly Audiences) | Resend owns unsubscribe flows, `List-Unsubscribe` headers, and suppression compliance. Building that correctly is more work than the newsletter itself. |
| Opt-in | Double, stateless | Protects sender reputation. No pending-subscriber table exists anywhere — see below. |
| Sending | Manual, per issue, in the Resend Broadcasts dashboard | Editorial control, and no risk that a bad build or a backdated post fires a real send. |
| Placement | End of every blog post and every project writeup | `BlogPostLayout.astro`, `ProjectLayout.astro`. |
| Unsubscribe | Nothing built | Resend Broadcasts handle it. Issues must include the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag. |

## Stateless double opt-in

The interesting part. There is no `subscribers` table — not in D1, not anywhere.

```
Reader submits SubscribeForm
  → POST /api/subscribe
      1. validate email, honeypot check, Turnstile verify   (same order as submit-comment.ts)
      2. mint a signed token: base64url({sub, email, exp}) + HMAC-SHA256
      3. Resend sends the confirmation email containing that token as a link
      4. 200 — identical response whether or not the address is already subscribed
  → reader clicks the link
  → GET /api/newsletter-confirm?t=<token>
      5. verify signature, purpose, and expiry
      6. POST /contacts to Resend  ← the ONLY write, anywhere, in the whole flow
      7. 302 to /newsletter/confirmed/  (or /newsletter/invalid/)
```

Consequences worth stating plainly:

- **An address that never confirms leaves no trace.** Nothing to store, nothing to expire out, and no
  unconfirmed addresses sitting in the sending list dragging deliverability down.
- **The token is single-purpose.** `sub: 'newsletter-optin'` is checked on the way in, so a signature
  minted here can't be replayed against the contact form's JWT even though both use
  `JWT_SIGNING_SECRET`.
- **Three-day expiry** (`TOKEN_TTL_SECONDS` in `functions/_lib/optin.ts`). Stated in the email, on the
  form's success message, and on the invalid page.
- **`/api/subscribe` returns the same 200 either way**, so it can't be used to probe whether a given
  address is on the list.
- **Re-clicking a valid link is idempotent to the reader.** `addContact` swallows a 409 from Resend.

## Files

| Path | Role |
|---|---|
| `src/components/SubscribeForm.astro` | Form + client script. Mirrors `ContactForm.astro` structurally. |
| `functions/api/subscribe.ts` | Step one: validate, Turnstile, mint token, send confirmation. |
| `functions/api/newsletter-confirm.ts` | Step two: verify token, create the Resend contact, redirect. |
| `functions/_lib/optin.ts` | Token mint/read. |
| `functions/_lib/resend.ts` | Two-call REST client — `sendEmail`, `addContact`. No SDK. |
| `src/pages/newsletter/confirmed.astro` | Success landing. |
| `src/pages/newsletter/invalid.astro` | Expired/forged-token landing. |

The official `resend` npm package was skipped deliberately: it pulls a React-email dependency tree to
wrap two `fetch` calls against a stable API, in a runtime where bundle size is cold-start cost.

## Environment

Set in the Cloudflare Pages dashboard (Settings → Variables and Secrets), **not** in a
`wrangler.toml` — see `CLAUDE.md` for why that file must stay out of this repo.

| Var | Notes |
|---|---|
| `RESEND_API_KEY` | Sending key. |
| `RESEND_SEGMENT_ID` | Resend renamed Audiences to Segments; the API takes `segments: [{id}]`. |
| `NEWSLETTER_FROM` | Verified sender on `makingcode.io`, e.g. `MakingCode <posts@makingcode.io>`. |
| `COMMENT_NOTIFY_TO` | New-comment pings. Optional — unset disables them silently. |
| `JWT_SIGNING_SECRET` | Already present for the contact form. Signs opt-in tokens too. |

## Send runbook

1. Draft the issue in Resend → Broadcasts, targeting the segment.
2. Include `{{{RESEND_UNSUBSCRIBE_URL}}}` in the HTML. Non-negotiable — it's the compliance surface.
3. Send to yourself first. Check the unsubscribe link resolves and images load.
4. Send to the segment.

Automating this (post publishes → email fires) was considered and deliberately left out. It needs a
trigger this static, push-to-deploy site doesn't have, and the failure mode — a backdated post
blasting the list — is worse than the manual step it saves.

## Voice-guide exception

`docs/design/voice-guide.md` §3 (funnel check) originally named newsletter signups as the failure
mode for any CTA outside `/work-with-me/` and `/contact/`. That rule was written before this feature
existed and has been amended rather than silently violated. The form's copy still holds the line the
rule was protecting: no separate content promised, no scarcity, no "never miss," the RSS feed offered
as the no-email alternative in the same paragraph.

## Not built

Automated post→email sending, a subscriber preferences page, per-post send targeting, open tracking.
