---
name: publish-check
description: Pre-publish checklist for MakingCode.io content — voice/brand check, frontmatter completeness, build verification — before pushing to master (which deploys live via Cloudflare Pages). Use when the user says something is "ready to publish", wants a pre-publish review, or is about to push content changes live.
---

# Publish Check

On this site, **push to `master` is publish** — Cloudflare Pages auto-builds and deploys on push,
there is no separate release step. Treat every one of these checks as real gates, not formalities,
because there's nothing between "looks done" and "live on the internet" except this checklist.

## Steps

1. **Identify what's changing.** If not given an explicit file, run `git status` / `git diff` scoped
   to `src/content/` to find the content files actually being changed in this round.

2. **Voice/brand check.** Either delegate to the `content-editor` agent, or run its checklist
   directly: read `brand-brief.md` and `docs/design/voice-guide.md`, then check each changed file
   for banned words/phrases, "we" used for solo work (or missing for genuine team work), funnel-y
   CTAs outside `/work-with-me/` and `/contact/`, and missing specifics where a claim needs a number.
   Report findings before doing anything else — don't silently fix and move on.

3. **Frontmatter & asset completeness.** Confirm every required field from `src/content.config.ts` is set,
   and specifically check:
   - `heroImage` — if set, verify the referenced file exists in `src/assets/blog/` or `src/assets/projects/`.
   - `draft` — is it intentionally `true` or `false`? A post left at the scaffold default of
     `draft: true` will silently not appear even after pushing; someone who meant to publish today
     and forgot to flip this will be confused when the site doesn't change.
   - `pubDate` — is it actually today (or the intended date), not left over from scaffolding?

4. **The scheduling caveat — say this explicitly if `pubDate` is in the future:** this site filters
   out future-dated and draft entries at *build* time (`src/lib/publishing.ts`), and Cloudflare Pages
   only rebuilds when something is pushed. A future `pubDate` will not make a post appear automatically
   the moment that date arrives — it appears at the *next push after* that date. If the user wants a
   hard "goes live at date X" behavior with no further action from them, tell them plainly that this
   infrastructure doesn't provide that yet (no cron rebuild is wired up) — the honest options are:
   hold the push until the date, or push now and let it land, or come back and push again (even a
   no-op commit) after the date to trigger the rebuild that makes it visible.

5. **Build verification.** Run `npm run build` (this runs `astro check`, the `functions/`
   TypeScript check, and the production build). Zero errors required — don't treat warnings as
   automatically fine, read them.

6. **Only after 2–5 pass**, summarize what's ready and let the user decide on the commit/push
   themselves — per this project's git safety rules, never commit or push without being asked to.
