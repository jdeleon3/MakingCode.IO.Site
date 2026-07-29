# Visual Design Refresh

Companion to `docs/migration-plan.md` Phase 2. Decision from the interview: **evolve, don't replace.**
The current token system reads as "engineering notebook" more than it reads as "agency" — the
agency feel comes mostly from copy and one component (`RealEstateSolutions`), not from color or type.
Keep the bones; retune the details that specifically reinforce the sales-pitch register.

## What stays as-is

- Token system in `src/styles/global.css` (`@theme` block): graphite surface, warm paper ink, blue
  accent, Fraunces display + IBM Plex Sans/Mono. This palette is distinctive and on-brief for a
  practitioner's notebook — no reason to touch it.
- `.label-mono` uppercase-tracked mono labels, `.corner-frame` blueprint corner-brackets, the subtle
  grid background on `body`. These read as "technical," not "corporate" — keep.
- `.prose` typography system (tables, code blocks, blockquotes) — this is infrastructure for the
  build-log content the brief wants more of. No change needed; Phase 3 comment threads should reuse
  these tokens rather than invent new ones.
- `Card.astro`, `ResponsiveTables.astro`, `CopyCodeButtons.astro` — functional, unrelated to tone.

## What changes, and why

| Component | Current | Change | Why |
|---|---|---|---|
| `Hero.astro` | "MakingCode — Systems Engineering" eyebrow; "Automated systems built for operators who can't afford downtime" | First-person eyebrow (e.g. a short "14 years enterprise → AI/ML" line); headline in first person, not third-person client pitch | Brief §6: second person for instructions, first person for experience — the current hero speaks *about* a hypothetical client, never *as* the author |
| `Hero.astro` CTA row | "Contact" / "View Projects" | Keep "View Projects," swap "Contact" primary CTA for something that leads with the writing (e.g. "Read the writing") with Contact/Work-with-me secondary | Home page's job is now to get someone reading, not booking a call |
| `Footer.astro` tagline | "Est. structural integrity in every deploy." | Rewrite — same playful register is fine, but drop the "structural/engineering-firm" slogan framing | Small thing, but it's a recurring footer on every page; worth 10 minutes in Phase 2 |
| Post layout | No author/byline treatment currently visible in `BlogPostLayout.astro` beyond `PostMeta` | Add a small first-person byline block (name, one-line current focus, links) at the top or bottom of posts | Brief is built around a named author's standing (§1) — the site should surface *who* is writing, not read as institutional/anonymous |
| `RealEstateSolutions.astro` | Vertical-focus pitch section on home | Removed (Phase 1) or replaced with neutral "recent work" strip (see IA doc) — if kept, style as a quiet teaser, not a landing-page sales block (no "border-l-2 accent + eyebrow + CTA-grade" treatment) | Component's current visual weight (accent top-bar, bordered pull-quote framing) *performs* "sales section" regardless of copy |
| New: `work-with-me.astro` | N/A | Gets the visual treatment `RealEstateSolutions`/current `about.astro` CTA band used to have (accent-bordered pull quotes, prominent CTA button) | This page is explicitly allowed to look like a pitch — concentrate that visual language here instead of spreading it across the whole site |
| Comment thread (Phase 3) | N/A | New component, built from existing tokens: `.label-mono` for meta (name/date), `.prose`-adjacent body styling, `border-(--color-border)` card per comment, accent-colored "pending moderation" state if a user's own unapproved comment is echoed back to them | Must not introduce a new visual language — reuse Card/prose patterns so it looks native, not bolted on |

## Explicit non-goals for Phase 2

- No color palette change.
- No typography swap (Fraunces/IBM Plex stay).
- No light-mode variant (site is `class="dark"` hardcoded in `BaseLayout.astro`; out of scope unless
  raised separately).
- No layout-system change (Tailwind 4 + existing max-w-6xl container rhythm stays).

## Review method

Before/after screenshots of: Home, About, new Work-with-me, a blog post with the new byline, and the
comment thread once Phase 3 lands. Check against `docs/design/voice-guide.md` for copy and against
this table for visual scope — a Phase 2 PR that touches tokens or introduces new components not listed
above should get flagged as scope creep, not waved through.
