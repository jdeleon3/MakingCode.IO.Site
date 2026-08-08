# Comments System — Technical Design

Companion to `docs/migration-plan.md` Phase 3. The brief's only CTA is "reply and tell me what
actually worked for you" — that needs a real reply surface on blog posts. This follows the existing
`functions/api/submit-contact.ts` pattern (Turnstile-verify → validate → forward) as closely as
possible.

**As-built note (2026-07-29):** this doc was written before implementation and originally called for
a service-role key and Cloudflare-KV rate limiting. Neither shipped in v1 — see the callouts below
for what changed and why. The rest of the design (schema, moderation model, display behavior) shipped
as planned.

**As-built note (2026-08-08) — datastore changed.** The system moved off hosted Supabase to
Cloudflare D1. Supabase pauses free-tier projects for inactivity, and a pause would have silently
broken the site's primary blog CTA. Migration cost was near zero: the `comments` table held **zero
rows** at cutover, so this was a schema recreate and a code swap, not a data migration. Sections
below are rewritten as-built; the Supabase rationale is preserved where it explains a decision that
still stands.

- **Live datastore:** Cloudflare D1 database `makingcode-io-comments`
  (`c185a546-9059-47d8-a48b-248a7532ee47`, ENAM), bound to the Pages project as `DB`.
- **Retired:** Supabase project `makingcode-io-comments` (ref `ggwmwuhrbntxagaanmjq`). Deleting it is
  a manual step, deliberately left to a human.

## Why D1

- **Same platform as everything else.** Pages Functions already run here; a D1 binding is one
  dashboard entry and no new vendor, no new key, no new outbound dependency at request time.
- **It does not pause.** That was the whole forcing function.
- **It removed a client-side dependency rather than porting one.** Under Supabase the browser talked
  to the database directly with the anon key, safe only because RLS restricted it. D1 has no public
  client at all, so the read path became `/api/comments` — the Supabase SDK left the browser bundle
  and the key left the shipped JS.

Turnstile stays for the same reason it was chosen originally: already wired into this repo, no new
integration surface. Rejected alternatives are unchanged — Giscus (requires readers to have GitHub
accounts) and off-site reply (doesn't give the CTA a home on the post).

## Data model

D1 (SQLite). Migration: `db/migrations/0001_comments.sql`.

| column | type | notes |
|---|---|---|
| `id` | `text` (pk) | `crypto.randomUUID()`, generated in the Function |
| `post_slug` | `text`, not null | matches the blog collection's `id` |
| `author_name` | `text`, not null, ≤100 | |
| `author_email` | `text`, not null, ≤200 | **never displayed publicly** — spam triage/replies only |
| `body` | `text`, not null, ≤2000 | |
| `status` | `text`, not null, default `'pending'` | `pending` \| `approved` \| `rejected` |
| `ip_hash` | `text` | salted SHA-256 of `CF-Connecting-IP`, never the raw IP |
| `created_at` | `text`, not null | ISO-8601, written by the Function |
| `moderated_at` | `text` | set when a decision is applied |

**Changed from the Postgres original:** the RLS policies are gone, because there is nothing left for
them to restrict. The old design leaned on `WITH CHECK (status = 'pending')` so that a browser
holding the anon key could not insert an already-approved row. With D1 the browser cannot reach the
database at all — `submit-comment.ts` is the only writer and it hard-codes the `'pending'` literal
into the INSERT. The length limits and the status enum carried over as SQLite `CHECK` constraints, so
the database still refuses malformed rows even if validation in the Function is ever bypassed.

`ip_hash` is now populated (it was carried unused in v1), salted with `JWT_SIGNING_SECRET` rather
than introducing another secret. It is still only groundwork for the deferred rate-limiting pass.

`moderated_at` is new — it orders the admin page's "recently moderated" list.

## API

`functions/api/submit-comment.ts` — write path, structurally unchanged from v1:

```
Browser (Turnstile widget + honeypot + comment form on BlogPostLayout)
  → POST /api/submit-comment
      1. parse + validate payload
      2. honeypot check — if `website` is non-empty, fake a 200 and drop the submission
      3. verify Turnstile token
      4. INSERT into D1 with status='pending', ip_hash populated
      5. waitUntil() a Resend notification email — best-effort, never blocks or fails the insert
  → 200 { ok: true, status: 'pending' }   (never auto-approved)
```

`functions/api/comments.ts` — **new**, the public read path. `GET /api/comments?slug=<id>` returns
approved comments as JSON, cached 60s. Selects four columns only; `author_email` and `ip_hash` cannot
leak through a query that never asks for them.

Shared helpers moved to `functions/_lib/` (underscore-prefixed so Pages doesn't route them):
`http.ts` (`json`), `turnstile.ts` (`verifyTurnstile`), `crypto.ts` (HMAC + salted hash, extracted
from `submit-contact.ts`), `access.ts`, `resend.ts`, `optin.ts`.

Env: `TURNSTILE_SECRET_KEY`, `JWT_SIGNING_SECRET`, and the `DB` binding. The two
`PUBLIC_SUPABASE_*` vars are retired.

## Spam controls (still no Cloudflare KV)

Unchanged from v1. Turnstile handles the bot problem for a single request; the honeypot (`website`,
visually hidden, `tabindex="-1"`) catches bots that fill every input blindly, and returns the same
`200 { ok: true }` a real submission gets so a bot gets no signal it was caught.

**Still deferred:** per-IP rate limiting via Cloudflare KV. `ip_hash` is now populated, so the data
side is ready; it still needs a KV namespace and binding wired into the live Pages project.

## Moderation

**Superseded.** v1 moderated through the Supabase table editor. D1 has no equivalent dashboard, and
the CLI was rejected as the primary path — so `/admin` is now a real page:

- `functions/admin/index.ts` — the whole thing. `onRequestGet` renders the pending queue with
  Approve/Reject buttons, plus the 25 most recently moderated for context and one-click reversal;
  `onRequestPost` applies a decision and 303s back so a refresh doesn't resubmit. Self-contained
  HTML, no framework, `noindex`.
- `functions/admin/_shared.ts` — the `requireAdmin` gate, applied to both handlers.

**GET and POST deliberately share one path.** Access matches application paths exactly unless
wildcarded: a Path of `admin` covers `/admin` only, and `admin/*` covers `/admin/moderate` but *not*
`/admin`. A separate `/admin/moderate` route would therefore need either two Access applications or
a wildcard that silently leaves one of them uncovered. One route means one path to protect and no
way to get the policy subtly wrong.

**Auth is Cloudflare Access, and this repo contains no auth code.** Configure it as
**Self-hosted** (not SaaS — that type is for third-party apps like Salesforce), with public hostname
`makingcode.io` and Path `admin`, plus one Allow policy for the owner's email. Access authenticates
at the edge and never forwards an unauthenticated request to the Function.

`functions/_lib/access.ts` is defense in depth, not the gate: it verifies the
`Cf-Access-Jwt-Assertion` header against the team's JWKS, checking signature, `iss`, `aud`, and
`exp`. If the Access application is ever deleted, its policy loosened, or its path pattern edited so
`/admin` falls outside it, these routes return 403 instead of quietly becoming a public
comment-moderation panel. Verified locally: requests arriving with a non-localhost `Host` and no
assertion get 403 on both routes.

`ADMIN_DEV_BYPASS=true` skips verification for local development, and only when the request host is
*also* localhost — so setting it in Pages by mistake cannot open up the deployed site. It still must
never be set there.

## Display: `Comments.astro`

- Client-side fetch against `/api/comments?slug=`, replacing the direct Supabase query. Same
  reasoning as before — it avoids converting the whole blog route from static to SSR — but now
  without shipping a database client or key to the browser.
- Renders `author_name`, `body`, `created_at` — never `author_email` or `ip_hash`.
- Empty state: "No replies yet. Be the first."
- Submitted-but-pending: the visitor sees their own comment locally with a "pending moderation"
  label, client-state only.
- The Turnstile widget now has an explicit id (`#turnstile-comment`) and `turnstile.reset()` targets
  it. Blog posts render two widgets since the newsletter form landed, and an un-targeted reset hits
  whichever rendered last.

## Local development

`npm run pages:dev` passes `--d1 DB=<id>`. Local D1 state is separate from production and starts
empty — run `npm run db:migrate:local` once to create the schema. Both `db:*` scripts point at
`db/wrangler.d1.jsonc` and pass `--persist-to .wrangler/state`; without that flag wrangler resolves
local state relative to the *config file's* directory and the schema lands in `db/.wrangler/`, where
`wrangler pages dev` will never find it.

## Acceptance criteria — verified 2026-08-08

- Submitting the form inserts a `pending` row in D1 (confirmed by querying the table, not inferred).
- `/api/comments?slug=` returns `[]` while that comment is pending.
- Filling the honeypot returns `200 { ok: true }` with no row written (table held exactly one row
  after both submissions).
- Approving through `/admin` flips the row and the comment appears in the public read, with
  `author_email` absent from the response.
- Both `/admin` handlers (GET and POST) return 403 when the request doesn't come from localhost and
  carries no Access assertion.
- **Follow-up, not a blocker:** per-IP rate limiting via Cloudflare KV.
