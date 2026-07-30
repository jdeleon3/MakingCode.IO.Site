# GEMINI.md

MakingCode.io — John DeLeon's personal engineering site (Astro, Tailwind 4, Cloudflare Pages). Voice
and positioning are governed by `brand-brief.md` (repo root) — read it before writing any user-facing
copy or content.

## Voice & content rules

- Source of truth: `brand-brief.md`. Operational checklist: `docs/design/voice-guide.md` (the banned-word
  grep pattern, a table of known past violations with file:line, and a passing-example reference).
- Before calling any new or edited content done, run the voice-guide checklist against it — directly,
  or via the `content-editor` agent.
- Never invent technical specifics for a project writeup. Ground it in real source material first (a
  repo, a PDF, a live URL) — use the `content-researcher` agent for this. `brand-brief.md` §8 requires
  real numbers tied to their actual source, not plausible-sounding ones.
- "We" is correct when describing genuine team work (e.g. the DOD capstone) and wrong for solo work —
  check which one applies rather than defaulting either way.

## Content model & file conventions

- Two collections: `src/content/blog/` and `src/content/projects/`. Schema lives in
  `src/content.config.ts` — read it before writing frontmatter by hand, since fields have changed
  (an old `industry` field became `domain`; `standing` and `draft` were added later).
- Common fields: `title`, `description`, `pubDate`, `updatedDate?`, `heroImage?`, `tags?`, `draft`
  (default `false`).
- Projects also have: `domain?`, `techStack?`, `impact?`, `featured` (default `false`), `standing?`
  (which `brand-brief.md` §1 credential this project demonstrates — leave unset unless it genuinely
  applies; not every project needs to be "hire me" evidence).
- The filename is the slug, the URL segment, and — for blog posts — the `post_slug` the comments
  system keys on. Choose it deliberately; treat it as effectively permanent once published.
- Images & Hero Assets:
  - Hero images: `src/assets/blog/` and `src/assets/projects/` (Astro-optimized via `astro:assets`).
  - Inline images: `public/images/projects/<slug>/` or `public/images/blog/<slug>/` for inline `<img>` tags referenced directly in markdown.
  - Use the `asset-generation` skill to generate or place hero images and inline visual assets matching the site's dark, technical aesthetic.
- Use the `new-post` skill to scaffold new files instead of hand-writing frontmatter from memory.

## Scheduling & publishing

- `draft: true` — never appears, regardless of `pubDate`. `draft: false` + a future `pubDate` —
  "scheduled," with a real caveat below.
- Filtering logic is `isPublished()` in `src/lib/publishing.ts`, applied at build time in every
  listing page, both `getStaticPaths` functions, and `rss.xml.js`.
- **This is a static site, rebuilt only on push to `master`.** A future-dated post does not appear the
  instant its date arrives — it appears at the next production build *after* that date. There is no
  cron rebuild wired up. Don't describe scheduling here as fully automatic ("goes live at 9am on its
  own") without that caveat — if true unattended scheduled publishing is wanted, it needs a scheduled
  rebuild trigger (e.g. a GitHub Actions cron hitting a Cloudflare Pages deploy hook), which doesn't
  exist yet.
- Run the `publish-check` skill before pushing content changes.

## Commands

- `npm run dev` — Astro dev server, fast iteration, but **does not run Cloudflare Pages Functions**
  (`functions/api/*`). `/api/submit-contact` and `/api/submit-comment` 404 under plain `dev`.
- `npm run pages:dev` — builds the site, then serves it (and `functions/`) through Wrangler's Pages
  emulator. Use this to test the contact form or comments end-to-end locally.
- `npm run build` — `astro check` + a separate `tsc` pass over `functions/` (its own isolated
  `tsconfig.json` — merging it with the root one breaks DOM typing globally, see the
  `securing-a-contact-pipeline` blog post) + `astro build`. Run before considering any change done.
- `npm run check` — `astro check` alone.

## Deploy

Cloudflare Pages is connected to this repo and auto-builds/deploys on push to `master`. There is no
separate deploy step — **push to master is publish.** That makes the git safety rules below more
important here, not less: never push without being explicitly asked, even when everything else checks
out.

## Comments & Supabase

- Submissions go through `functions/api/submit-comment.ts` → Supabase, using only the public anon key
  — RLS restricts it to inserting `pending` rows and reading `approved` ones. No service-role key
  exists anywhere in this flow. Full design and as-built deltas: `docs/design/comments-system.md`.
- Moderation is manual, via the Supabase table editor (flip `status` from `pending` to
  `approved`/`rejected`). No admin UI exists in this repo.

## Agents & skills for this workflow

- **`content-editor`** agent — reviews a draft against `brand-brief.md`/`docs/design/voice-guide.md`,
  reports specific violations with fixes.
- **`content-researcher`** agent — grounds a new project writeup in a real repo/PDF/live URL before
  anything gets drafted.
- **`new-post`** skill — scaffolds a new blog/project file with correct, draft-by-default frontmatter.
- **`publish-check`** skill — pre-publish checklist (voice, frontmatter, build) run before pushing.
- **`asset-generation`** skill — creates and places tailored hero images and technical diagrams using `generate_image` tool.

## Content Engine (external, most blog content comes from here)

`C:\Projects\MakingCode.IO.ContentPipeline` — a separate, mature pipeline (`ce`) that harvests git
history + voice memos from finished projects, drafts/grades/verifies articles, and runs
`ce publish site` to write straight into `src/content/blog/` and push. It only ever targets the blog
collection, never `src/content/projects/` — deep project writeups stay the manual workflow above.

It has its own copy of `content-editor` (`.claude/agents/content-editor.md` in that repo) that reads
*this* repo's `brand-brief.md`/`docs/design/voice-guide.md` directly via absolute path before
`ce publish site` runs — a manually-synced mirror, not auto-updated. If this repo's voice-guide
checklist changes, that copy needs a matching update or it'll drift.

## Git safety

Never commit or push without being explicitly asked. (This environment auto-checkpoints locally at
certain points — that's separate from pushing, and doesn't change the rule: pushing to `master` goes
live, so it only happens when asked.)
