# MakingCode.io

Source for [makingcode.io](https://makingcode.io) — John DeLeon's engineering site. Build logs from
the transition out of enterprise software into AI/ML and business automation, plus deep writeups of
finished projects.

Astro 7 (static) · Tailwind 4 · Cloudflare Pages + Pages Functions · Cloudflare D1 · Resend.

## Quickstart

```bash
npm install
cp .env.example .env        # fill in the values you need
npm run dev                 # http://localhost:4321
```

`npm run dev` is the fast path for content and layout work. It does **not** run Pages Functions, so
every `/api/*` route 404s under it — the contact form, comments, and newsletter signup will all fail.
For those:

```bash
npm run db:migrate:local    # once — creates the comments schema in local D1
npm run pages:dev           # http://localhost:8788, functions and D1 attached
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Astro dev server. No Pages Functions. |
| `npm run pages:dev` | Builds, then serves the site *and* `functions/` through Wrangler with the D1 binding. |
| `npm run build` | `astro check` + `tsc` over `functions/` + `astro build`. **Run before considering any change done.** |
| `npm run check` | `astro check` alone. |
| `npm run db:migrate` | Applies `db/migrations/` to the **production** D1 database. |
| `npm run db:migrate:local` | Same, against local D1 state. |
| `npm run db:query "<sql>"` | Ad-hoc query against local D1. |

`functions/` type-checks under its own isolated `tsconfig.json`. Merging it into the root config
breaks DOM typing across the project — see the `securing-a-contact-pipeline` post for the long
version.

## Layout

```
src/content/blog/          field notes — the collection the Content Engine writes into
src/content/projects/      project writeups — always authored by hand
src/content.config.ts      collection schemas; read before writing frontmatter
src/lib/publishing.ts      isPublished() — the draft + future-date filter
src/lib/feed.ts            sanitizes and absolutizes post HTML for the RSS feed
functions/api/             public endpoints (contact, comments, subscribe, confirm)
functions/admin/           comment moderation queue, behind Cloudflare Access
functions/_lib/            shared helpers — underscore-prefixed so Pages doesn't route them
db/migrations/             D1 schema
docs/design/               design docs, written before implementation and amended as-built
```

Anything under `functions/` becomes a route unless its directory starts with `_`. That's why shared
code lives in `functions/_lib/`.

## How the moving parts fit

**Content.** Two collections, both filtered through `isPublished()` at build time: `draft: true`
never publishes, and a future `pubDate` waits. Because this is a static site rebuilt on push, a
future-dated post appears at the next production build *after* its date, not the instant it arrives.
There's no cron rebuild wired up.

**Comments.** Written by `functions/api/submit-comment.ts` (Turnstile → honeypot → D1 insert, always
`pending`), read by `functions/api/comments.ts`. No public database client exists — the browser only
ever talks to those two endpoints. Moderation is a page at `/admin`, protected by a Cloudflare Access
application; this repo contains no auth code, and `functions/_lib/access.ts` re-verifies the Access
JWT so the route fails closed if that policy is ever removed.

**Newsletter.** Double opt-in with no subscriber table anywhere: the confirmation link carries a
signed, expiring token, and the contact is created in Resend only when it's clicked. An address that
never confirms leaves no trace. Issues are composed and sent manually in the Resend dashboard.

**RSS.** `/rss.xml` carries full post bodies, sanitized, with asset URLs rewritten absolute so images
survive in feed readers. `public/rss/styles.xsl` makes it readable when opened in a browser.

## Configuration

Every variable is documented in `.env.example`. Production values live in the Cloudflare Pages
dashboard under Settings → Variables and Secrets.

> **Do not add a `wrangler.toml` or `wrangler.jsonc` to the repo root.** Pages treats one containing
> `pages_build_output_dir` as the source of truth for the project, which makes every dashboard-set
> variable read-only and strands the existing secrets. Bindings are configured in the dashboard;
> local development passes them as `wrangler pages dev` flags. `db/wrangler.d1.jsonc` exists only for
> `wrangler d1` CLI commands, is deliberately not at the root, and omits that key.

## Deploy

Cloudflare Pages builds and deploys on push to `master`. There is no separate deploy step — **push to
master is publish.**

## Docs

| Doc | Contents |
|---|---|
| `brand-brief.md` | Voice and positioning. Source of truth for anything a reader sees. |
| `docs/design/voice-guide.md` | The operational checklist run against copy before it ships. |
| `docs/design/comments-system.md` | Comments: schema, moderation, the Supabase → D1 migration. |
| `docs/design/newsletter.md` | Opt-in flow, token format, send runbook. |
| `docs/design/information-architecture.md` | Nav order, URL structure. |
| `docs/design/visual-design.md` | Type scale, palette, component patterns. |
| `CLAUDE.md` | Conventions and constraints for AI-assisted work in this repo. |
