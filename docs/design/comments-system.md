# Comments System — Technical Design

Companion to `docs/migration-plan.md` Phase 3. The brief's only CTA is "reply and tell me what
actually worked for you" — that needs a real reply surface on blog posts. This follows the existing
`functions/api/submit-contact.ts` pattern (Turnstile-verify → validate → forward) as closely as
possible, swapping the n8n forward for a Supabase insert.

**As-built note (2026-07-29):** this doc was written before implementation and originally called for
a service-role key and Cloudflare-KV rate limiting. Neither shipped in v1 — see the two callouts below
for what changed and why. The rest of the design (schema, moderation model, display behavior) shipped
as planned.

- **Live project:** Supabase project `makingcode-io-comments` (ref `ggwmwuhrbntxagaanmjq`, `us-east-1`,
  free tier), under the `MakingCode.IO` org. Created via the Supabase MCP tools with explicit cost
  confirmation ($0/month) before provisioning.

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

**Changed from the original plan:** the Supabase MCP tools deliberately don't expose service-role
keys (they only hand out publishable/anon keys) — reasonable, since a service-role key bypasses RLS
entirely and shouldn't be mintable by a tool call. Rather than route around that, the design changed
to not need one: the `anon` key gets an `INSERT` policy scoped by `WITH CHECK (status = 'pending')`.
A client (or the Cloudflare Function) can only ever insert rows already forced to `pending` — it
cannot set `status = 'approved'` no matter what it sends, because the check runs against the row
being written, not client input. The same `anon`/publishable key is safe to use client-side (for
reading `approved` rows) and inside the Cloudflare Function (for writing `pending` rows). No
service-role secret exists anywhere in this flow.

`ip_hash` remains in the schema for a future rate-limiting pass (see below) but is not populated by
v1 — the column is nullable and simply unused for now.

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

create index comments_post_slug_status_idx on comments (post_slug, status);

alter table comments enable row level security;

create policy "public can read approved comments"
  on comments for select
  using (status = 'approved');

create policy "public can insert pending comments"
  on comments for insert
  with check (status = 'pending');
```
`get_advisors(type: 'security')` on the live project returns zero lints against this schema.

## API: `functions/api/submit-comment.ts`

Structurally mirrors `submit-contact.ts`:

```
Browser (Turnstile widget + honeypot field + comment form on BlogPostLayout)
  → POST /api/submit-comment
      1. parse + validate payload (postSlug, authorName, authorEmail, body, turnstileToken, website)
      2. honeypot check — if `website` is non-empty, fake a 200 success and drop the submission
      3. verify Turnstile token (reuse the verifyTurnstile() pattern from submit-contact.ts)
      4. insert row into Supabase (anon key) with status='pending'
  → 200 { ok: true, status: 'pending' }   (never auto-approved)
```

Env additions (`Env` interface + Cloudflare Pages secrets) — as implemented in
`functions/api/submit-comment.ts`:

```ts
interface Env {
  TURNSTILE_SECRET_KEY: string;      // existing
  PUBLIC_SUPABASE_URL: string;       // new — safe to expose, RLS does the restricting
  PUBLIC_SUPABASE_ANON_KEY: string;  // new — same key used client-side in Comments.astro
}
```

Validation rules (mirror `parseContactPayload`): trim all fields, reject empty, enforce max lengths
from the table above, basic email pattern check. `post_slug` is accepted as-is (no build-time
allowlist) — a junk slug can never render anywhere, since `Comments.astro` only ever queries for the
exact slug of the post it's mounted on.

## Spam controls (v1: no Cloudflare KV)

Turnstile handles the bot problem for a single request. A honeypot field (`website`, visually hidden,
`tabindex="-1"`, never seen or filled by a real visitor) catches the class of bot that fills every
input blindly, without adding a database round-trip or a new secret. When triggered, the function logs
a warning server-side and returns the same `200 { ok: true }` a real submission gets — a spam bot
gets no signal it was caught, so it has no error response to adapt against.

**Deliberately deferred:** per-IP rate limiting via Cloudflare KV. It needs a KV namespace and a
binding wired into the live Pages project, and no tool available in this session can set Pages
production bindings — that's a dashboard/CLI step for whoever holds Cloudflare access. The `ip_hash`
column already exists in the schema for when that lands; until then, Turnstile + the honeypot are the
only defenses, which is the same protection level the existing contact form has always run on.

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
- A second Supabase `anon`-key query cannot read `pending`/`rejected` rows (RLS test — enforced by the
  `select` policy; no separate test needed since there is no broader-access key in play).
- Filling the honeypot field returns a `200 { ok: true }` without a row appearing in Supabase.
- An approved comment renders on the correct post only (`post_slug` scoping verified with two posts).
- **Follow-up, not a v1 blocker:** per-IP rate limiting via Cloudflare KV once bindings can be wired
  into the live Pages project.
