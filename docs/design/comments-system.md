# Comments System — Technical Design

Companion to `docs/migration-plan.md` Phase 3. The brief's only CTA is "reply and tell me what
actually worked for you" — that needs a real reply surface on blog posts. This follows the existing
`functions/api/submit-contact.ts` pattern (Turnstile-verify → validate → forward) as closely as
possible, swapping the n8n forward for a Supabase insert.

## Why Supabase + Turnstile over alternatives

- **Supabase** is already the stack's database (used on the ordering-site project per the brief) —
  no new vendor, and building this out is itself a legitimate build-log post (§1 standing: "directed
  an AI-assisted build... configured the self-hosted n8n automation").
- **Turnstile** is already wired into this repo (`ContactForm.astro`, `submit-contact.ts`) — reusing
  the site key/secret pattern means no new integration surface, just a second endpoint.
- Rejected: Giscus (requires readers to have GitHub accounts — friction for a broader audience than
  this repo's own contributors) and off-site reply (email/social) — doesn't give the "reply" CTA a
  visible home on the post itself, which is the point.

## Data model

New Supabase table, `comments`:

| column | type | notes |
|---|---|---|
| `id` | `uuid` (pk, default `gen_random_uuid()`) | |
| `post_slug` | `text`, not null | matches the blog collection's `id` (e.g. `securing-a-contact-pipeline-cloudflare-turnstile-n8n`) |
| `author_name` | `text`, not null, max 100 | |
| `author_email` | `text`, not null, max 200 | **never displayed publicly** — stored for spam triage/replies only |
| `body` | `text`, not null, max 2000 | |
| `status` | `text`, not null, default `'pending'` | `pending` \| `approved` \| `rejected` |
| `ip_hash` | `text` | SHA-256 of `CF-Connecting-IP`, salted — for rate-limiting/abuse review, not raw IP storage |
| `created_at` | `timestamptz`, default `now()` | |

Row-level security: public `anon` role gets `SELECT` where `status = 'approved'` only. All `INSERT`s
go through the Cloudflare Function using the **service role key** (server-side only), never a
client-side Supabase call — mirrors how `submit-contact.ts` never exposes `N8N_WEBHOOK_URL` to the
browser.

```sql
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null,
  author_name text not null check (char_length(author_name) <= 100),
  author_email text not null check (char_length(author_email) <= 200),
  body text not null check (char_length(body) <= 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  ip_hash text,
  created_at timestamptz not null default now()
);

alter table comments enable row level security;

create policy "public can read approved comments"
  on comments for select
  using (status = 'approved');
```
(No insert/update policy for `anon` — all writes go through the service-role-authenticated function.)

## API: `functions/api/submit-comment.ts`

Structurally mirrors `submit-contact.ts`:

```
Browser (Turnstile widget + comment form on BlogPostLayout)
  → POST /api/submit-comment
      1. parse + validate payload (post_slug, author_name, author_email, body, turnstileToken)
      2. verify Turnstile token (reuse verifyTurnstile())
      3. rate-limit check (see below)
      4. hash IP, insert row into Supabase with status='pending'
  → 200 { ok: true, status: 'pending' }   (never auto-approved)
```

Env additions (`Env` interface + Cloudflare Pages secrets):

```ts
interface Env {
  TURNSTILE_SECRET_KEY: string;   // existing
  SUPABASE_URL: string;           // new
  SUPABASE_SERVICE_ROLE_KEY: string; // new — server-side only
}
```

Validation rules (mirror `parseContactPayload`): trim all fields, reject empty, enforce max lengths
from the table above, basic email pattern check. `post_slug` must match an existing blog entry —
validate against a small allowlist generated at build time (or just accept any string and let it 404
harmlessly if it doesn't match a real post; recommend the allowlist for defense-in-depth).

## Rate limiting / abuse controls

Turnstile handles the bot problem for a single request. It does not stop a human from spamming
multiple posts. Add a lightweight secondary control:

- **Cloudflare KV** (or D1, if already provisioned) keyed on `ip_hash`, storing a rolling count with a
  short TTL (e.g. max 3 submissions per 10 minutes per IP). Reject with 429 over the limit.
- This is intentionally simple — v1 doesn't need a full abuse-scoring system. If spam becomes a real
  problem post-launch, that's a follow-up, not a Phase 3 blocker.

## Moderation

**v1: manual, via the Supabase table editor.** No admin UI gets built for this migration — flip
`status` from `pending` to `approved`/`rejected` directly in Supabase's dashboard. This is the right
tradeoff for a low-volume personal blog and avoids building auth/admin surface area that isn't the
point of this migration. Revisit only if comment volume makes manual moderation impractical.

## Display: `Comments.astro`

- Server-rendered (or fetched at request time — the current site is `output: 'static'` per the
  contact-pipeline post, so this needs either a per-post SSR route or a client-side fetch against a
  public read endpoint hitting Supabase directly with the `anon` key, which RLS restricts to
  `approved` rows only). Recommend: client-side fetch using the Supabase JS client with the public
  `anon` key — RLS makes this safe (`anon` can only ever see `approved` rows), and it avoids a
  static→SSR conversion for the whole blog route.
- Renders `author_name`, `body`, `created_at` — never `author_email` or `ip_hash`.
- Empty state: no funnel language — something like "No replies yet. Be the first," consistent with
  §9's CTA phrasing, not a generic "no comments" placeholder.
- Submitted-but-pending state: after a successful POST, show the visitor their own comment locally
  (optimistic, client-state only) with a "pending moderation" label — don't re-fetch from Supabase
  (it won't be there yet) and don't imply it's already public.

## Acceptance criteria (ties to migration-plan.md Phase 3)

- Submitting the form inserts a `pending` row in Supabase — confirmed via dashboard, not inferred.
- A second Supabase `anon`-key query cannot read `pending`/`rejected` rows (RLS test).
- `SUPABASE_SERVICE_ROLE_KEY` does not appear anywhere in the built `dist/` output (grep after build).
- Four rapid submissions from the same IP trigger the 429 rate limit on the fourth.
- An approved comment renders on the correct post only (`post_slug` scoping verified with two posts).
