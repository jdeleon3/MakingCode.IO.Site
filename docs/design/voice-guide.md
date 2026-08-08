# Voice Guide — Working Checklist

Operational checklist for applying `brand-brief.md` to actual site copy during Phases 1 and 4. The
brief is the source of truth; this is the fast pass you run against a specific page or post before
calling it done. Don't duplicate the brief's reasoning here — just the checks.

## Before marking any page/post done

1. **Person check** — first person for anything experiential ("I built," "I haven't tested"), second
   person for instructions. No "we" for solo work (caught in the audit: `order-intake-mini-crm-template.md`
   uses "we built... we're packaging" — this is one person's work per the brief).
2. **Banned word/phrase scan** — grep the page against §7's list before merging. Known hit already
   found: `about.astro:49` — "seamlessly." Run this for real, don't eyeball it:
   ```
   grep -inE "delve|dive into|deep dive|unlock|unleash|game-changer|revolutionize|harness the power|seamless|robust|cutting-edge|leverage|elevate your|supercharge|transformative|in today's|it's important to note|at the end of the day|when it comes to|navigate the complexities|testament to|not just .* but|it's not about" <file>
   ```
3. **Funnel check** — does this CTA read as a course/signup funnel, even implicitly? If the page isn't
   `/work-with-me/` or `/contact/`, the only acceptable CTA is a variant of "reply and tell me what
   worked for you" (§9). Sales-scoping-call language ("structural scoping conversation") is confined
   to `/work-with-me/` only.

   **Amended 2026-08-08:** `SubscribeForm.astro` is a deliberate, standing exception — it ships at
   the end of every blog post and project writeup. It is not a blanket license for newsletter
   marketing copy; it passes because it holds the line this rule protects. Judge any change to it
   against those constraints: no separate content promised beyond the posts themselves, no scarcity
   or "never miss," no implied schedule, and the RSS feed offered as the no-email alternative in the
   same paragraph. Copy that drops those is a violation again.
4. **Specificity check** (§6/§8) — every claim has a number, version, dataset size, or named project
   attached. "My guess is" prefixes anything extrapolated, with what would change your mind stated
   next to it. No claim implies production use of something that was a class or side project.
5. **Standing check** (§1) — does this page claim expertise the brief explicitly disclaims (performance
   engineering, security, frontend design)? If so, either cut the claim or reframe it as "I think about
   this, I'm not deep in it" — matching §1's own framing exactly.
6. **Structural bans** — no rule-of-three list with a filler third item, no stacked em-dash asides
   (more than one per paragraph), no rhetorical-question section openers, no "In conclusion" on
   anything under 2,000 words.
7. **Sentence-level** — lead with the finding, cut throat-clearing ("let's dive into," any scene-
   setting sentence). If a sentence could appear in any other post on this topic, cut it (§6).

## Known findings from the initial audit (fix during their respective phases)

| File | Line | Issue | Phase |
|---|---|---|---|
| `src/pages/about.astro` | 49 | "seamlessly" — banned word | 1 |
| `src/pages/about.astro` | 80 | "START A STRUCTURAL SCOPING CONVERSATION" — funnel-flavored, agency-CTA register | 1 |
| `src/pages/index.astro` | 44 | "Ready to remove the manual work from your operation?" — third-person client-pitch framing on the home page, which shouldn't pitch at all post-migration | 1 |
| `src/components/Hero.astro` | 15 | "operators who can't afford downtime" — speaks about a hypothetical client rather than in first person | 1 |
| `src/components/RealEstateSolutions.astro` | whole file | Vertical-focus agency pitch; retire or neutralize per IA doc | 1 |
| `src/content/projects/order-intake-mini-crm-template.md` | 24, 32 | "We built," "we're packaging" — no "we" for solo work | 4 |
| `src/components/Footer.astro` | 21 | "Est. structural integrity in every deploy" — agency-slogan register, low priority | 2 |

## What a passing page looks like

Reference `src/content/blog/securing-a-contact-pipeline-cloudflare-turnstile-n8n.md`'s opening
paragraph as the closest existing example of the target voice: leads with a concrete claim ("a mailto
link is not a contact pipeline"), specific ("Cloudflare Pages Function," "Hetzner VPC," "JWT"), no
throat-clearing. It still needs a first-person/"we" check (see table above) but the sentence-level
register is close to right — use it as the calibration example when rewriting other pages.
