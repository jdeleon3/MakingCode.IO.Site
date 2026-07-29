# MakingCode.io Migration Plan

Repositioning the site from a B2B automation-agency pitch (real estate brokerages / operators) to a
personal engineering brand built on `brand-brief.md`: first-person build logs and a deliberate
career-transition narrative (14 years enterprise → AI/ML and business automation), aimed at
experienced engineers making the same move.

This plan assumes the decisions below, made during the scoping interview on 2026-07-28. If any of
these change, the phase they touch needs to be re-scoped before work starts.

## Decisions locked in

| Question | Decision |
|---|---|
| Scope of pivot | Full reposition. Retire the agency/real-estate framing site-wide. Services survive as **one** dedicated page, not the site's identity. |
| Contact | Stays a real services-inquiry path (`ContactForm.astro`, `/api/submit-contact`) — brief's "reply" CTA governs blog posts, not the whole site. |
| Blog reply CTA | Needs on-site commenting + spam protection, not just a mailto/social link. |
| Comments infra | Supabase (already used on the ordering-site project) + Cloudflare Turnstile, following the existing `submit-contact.ts` pattern. Doubles as a portfolio-worthy build log per §1. |
| Existing project write-ups | Rewrite in brief's voice rather than cut. They're evidence for §1 standing. |
| "Work with me" service scope | Broaden beyond real estate to general AI/automation-integration consulting; real estate becomes one proof point, not the identity. |
| Visual design | Evolve the current system (graphite/paper-ink/blue-accent, Fraunces + IBM Plex Mono, blueprint corner-frames) rather than a ground-up redesign. Soften the "systems-engineering firm" tone, keep the bones. |
| Rollout | Phased, reviewed between phases. |

## Known voice violations in current copy (found during audit)

These are concrete, not illustrative — grep confirms them:

- `src/pages/about.astro:49` — "seamlessly feed your long-term reporting metrics" — `seamlessly` is banned (§7).
- `src/pages/index.astro:44` — "Ready to remove the manual work from your operation?" — generic agency CTA framing, rhetorical-question-adjacent.
- `src/pages/about.astro:80` — "START A STRUCTURAL SCOPING CONVERSATION" — funnel-flavored CTA language, exactly what §11 calls out as the failure mode.
- `src/components/Hero.astro:15` — "operators who can't afford downtime" — third-person client-pitch framing, not first-person practitioner voice.
- `src/components/RealEstateSolutions.astro` — entire component is vertical-focus agency pitch; slated for removal (Phase 1).
- `src/content/projects/order-intake-mini-crm-template.md:24,32` — "We built…", "we're packaging" — brief §6 explicitly bans "we" for solo work.
- `src/components/Footer.astro:21` — "Est. structural integrity in every deploy" — cute, but reinforces the agency-slogan register. Candidate for rewrite, low priority.

---

## Phase 0 — Foundations (no visible change)

Groundwork so later phases don't reshuffle the same files twice.

1. **Content model update** (`src/content.config.ts`)
   - Generalize `projects.industry` → `domain` (free text, no real-estate-specific implication) or drop it in favor of `tags`. Recommendation: drop `industry`/`featured`-for-real-estate coupling; `featured` becomes a general "show on home" flag, unrelated to vertical.
   - Add optional `standing` field to `projects` (short string) to let a project self-tag which §1 credential it demonstrates (e.g. `"DOD-funded capstone"`, `"production ordering site"`) — used by the About page and Work-with-me page to cite specific evidence instead of vague claims (§8).
2. **IA sign-off** — see `docs/design/information-architecture.md`. Confirms nav order, URL structure, and what happens to `RealEstateSolutions.astro`.
3. **Voice reference** — see `docs/design/voice-guide.md`. This is the working checklist every rewritten page/post gets run against before it's considered done.

**Acceptance:** schema change compiles (`npm run check`), IA doc and voice guide reviewed and approved.

---

## Phase 1 — IA + voice/copy rewrite (site shell)

Everything a visitor sees before they read a single post. No visual redesign yet — reuse existing
components/tokens, just replace copy and remove the real-estate vertical section.

**Files touched:**
- `src/consts.ts` — `SITE_DESCRIPTION`, `NAV_LINKS` (add `Work with me`).
- `src/components/Hero.astro` — rewrite to first-person, career-transition framing.
- `src/pages/index.astro` — remove `RealEstateSolutions` import/usage; rewrite the closing CTA band.
- `src/components/RealEstateSolutions.astro` — delete, or repurpose into a generic "recent work" strip if the home page still wants a portfolio teaser (decide during Phase 1, doesn't block starting).
- `src/pages/about.astro` — full rewrite per §1/§8 (named credentials, dated, scoped honestly — no "seamlessly," no "structural scoping conversation").
- **New:** `src/pages/work-with-me.astro` — the single services page. Broadened scope (general AI/automation integration, not real-estate-only), honest about what's a side project vs. production (§8), CTA can legitimately be sales-oriented here since this page's whole job is the inquiry.
- `src/components/Header.astro` / `src/components/Footer.astro` — nav/tagline updates for the new page and tone.
- `src/components/ContactForm.astro` — copy pass only (heading/description), keep the mechanism as-is.

**Acceptance:**
- Every string above passes the voice-guide checklist.
- No page references "brokerage," "operator," or real-estate-vertical framing outside `work-with-me.astro`'s proof-point section.
- Nav includes Work with me; `/work-with-me/` is reachable and distinct in intent from `/contact/` (one pitches, one is the form).
- `npm run build` passes.

---

## Phase 2 — Visual design refresh

See `docs/design/visual-design.md` for the full spec. Summary: keep the token system and blueprint
motif, retune specific components so they read as a practitioner's notebook rather than an agency
one-pager.

**Files touched:** `src/styles/global.css` (token/detail tuning, not a token rewrite), `Hero.astro`,
`Card.astro`, `Footer.astro`, new byline/author component for posts.

**Acceptance:** visual diff reviewed against the before/after table in the design doc; no regression
in `ResponsiveTables`/`CopyCodeButtons` behavior; Lighthouse/contrast check on any color changes.

---

## Phase 3 — Comments + spam protection

See `docs/design/comments-system.md` for the full technical spec (schema, API contract, moderation,
rate limiting). Summary of scope:

- New Supabase table (`comments`) with a moderation queue (`pending` → `approved`/`rejected`).
- New Cloudflare Pages Function `functions/api/submit-comment.ts`, structurally mirroring
  `submit-contact.ts` (Turnstile verify → validate → insert), swapping the n8n-forward step for a
  Supabase insert.
- New Astro component `Comments.astro` (or SSR fetch on the blog post layout) that reads only
  `approved` rows for a given post slug.
- `BlogPostLayout.astro` gets a comment thread below the post body, styled per Phase 2's tokens.
- `.env` / Cloudflare Pages secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only,
  never shipped to the client), reuse existing `TURNSTILE_SECRET_KEY`/`PUBLIC_TURNSTILE_SITE_KEY`.

**Acceptance:** a comment submitted through the UI lands in Supabase as `pending`; only `approved`
rows render on the post; a scripted flood of submissions is rate-limited/blocked; no service-role key
reaches client-side JS (verify in built output, not just source).

---

## Phase 4 — Project/blog content rewrite

Rewrite existing content in the brief's voice; write any new pieces needed to cover §1 standing that
isn't yet represented on the site.

**Existing, rewrite:**
- `src/content/projects/order-intake-mini-crm-template.md` — drop "we," add first-person build-log
  framing, keep the real numbers/specifics that are already there (those are good — §6/§8 compliant).
- `src/content/blog/securing-a-contact-pipeline-cloudflare-turnstile-n8n.md` — light pass, mostly
  already close to brief voice; check for "we."
- `src/content/blog/architecting-idempotent-webhook-pipelines.md` — voice-guide pass.
- Decide fate of the deleted `real-estate-lead-routing-automation.md` project: rewrite as a
  generalized case study (drop vertical framing, keep the engineering substance) or leave retired —
  decide at start of this phase, not now.

**New (only if needed to support §1 claims made on About/Work-with-me):**
- DOD-funded capstone (Kafka/Spark/Neo4j/TimescaleDB, GNN anomaly detection) — currently only
  referenced in the brief, not written up anywhere on the site.
- Fraud-detector project (text classification, AWS CDK deploy) — same gap.

**Acceptance:** every project/post referenced by name on About or Work-with-me actually exists as a
page; every piece passes the voice-guide checklist; no orphaned claims (§8: never imply production use
of something that was a class/side project).

---

## Sequencing notes

- Phase 0 blocks everything — do it first, it's small.
- Phase 1 and Phase 4 can run concurrently once Phase 0 lands (copy rewrite of shell vs. copy rewrite
  of content are independent files).
- Phase 2 depends on Phase 1 being content-stable (no point retuning a component whose copy is about
  to change).
- Phase 3 is the only phase with new backend surface area (Supabase + a new Cloudflare Function) —
  budget the most review time here; it's the one place a mistake (leaked service key, no rate limit)
  has real consequences.

## Open items to revisit, not blocking start

- Fate of `real-estate-lead-routing-automation.md` (rewrite vs. leave retired) — Phase 4.
- Whether `RealEstateSolutions.astro` gets deleted outright or repurposed into a generic recent-work
  strip — Phase 1.
- Moderation UI for comments: manual via Supabase dashboard (v1, no extra surface) vs. a lightweight
  authenticated admin page — default to dashboard-only for v1, documented in Phase 3 doc.
