# Information Architecture

Companion to `docs/migration-plan.md` Phase 0/1. Defines the sitemap, nav, and content-model changes
for the reposition.

## Sitemap

| Path | Purpose | Change from current |
|---|---|---|
| `/` | Home — first-person intro, latest writing, light portfolio teaser | Rewrite Hero, remove `RealEstateSolutions` section |
| `/blog/` | Index of build logs / career-transition writing | Unchanged structurally |
| `/blog/[slug]/` | Post — now with comment thread (Phase 3) | Adds `Comments.astro` below post body |
| `/projects/` | Portfolio index | Unchanged structurally |
| `/projects/[slug]/` | Project write-up | Content rewritten (Phase 4) |
| `/about/` | Standing (§1) — who you are, what you've built, what you don't claim | Full rewrite |
| `/work-with-me/` | **New.** The one page allowed to pitch services | New page |
| `/contact/` | Services inquiry form | Copy pass only, mechanism unchanged |

## Nav order

```
Home · Blog · Projects · About · Work with me         [Contact — persistent header CTA]
```

Rationale: brief's audience comes for the writing, not the pitch. Blog and Projects sit ahead of
About in practice (they're already before About in `NAV_LINKS`); Work with me is new and goes last in
the primary nav, with Contact kept as the header's persistent action button (matches current
`Header.astro` pattern — no structural change to the component, just the link list length).

`src/consts.ts` change:

```ts
export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/blog/', label: 'Blog' },
  { href: '/projects/', label: 'Projects' },
  { href: '/about/', label: 'About' },
  { href: '/work-with-me/', label: 'Work with me' },
];

export const WORK_WITH_ME_PATH = '/work-with-me/';
```

`SITE_DESCRIPTION` should stop being agency copy:

```diff
- 'Automated systems engineering for real estate brokerages and B2B operators.'
+ 'Build logs and a career-transition record: 14 years of enterprise software, now applied to AI/ML and business automation.'
```
(Exact string is a Phase 1 copy task, subject to the voice-guide pass — this is a placeholder shape,
not final copy.)

## Content model changes (`src/content.config.ts`)

Current `projects` schema couples "featured" and "industry" to the real-estate vertical pitch
(`RealEstateSolutions.astro` filters on `industry.includes('real estate')`). That coupling goes away
with the component.

```diff
     schema: ({ image }) =>
       z.object({
         title: z.string(),
         description: z.string(),
         pubDate: z.coerce.date(),
         updatedDate: z.coerce.date().optional(),
         heroImage: image().optional(),
         tags: z.array(z.string()).optional(),
-        industry: z.string().optional(),
+        domain: z.string().optional(),
         techStack: z.array(z.string()).optional(),
         impact: z.string().optional(),
         featured: z.boolean().optional().default(false),
+        standing: z.string().optional(),
       }),
```

- `domain` replaces `industry`: free-text context ("cottage-food bakery," "DOD hardware-in-the-loop
  testbed") without implying a vertical the whole site serves.
- `featured` keeps its meaning (show on home) but loses any real-estate-specific filter logic — home
  page just takes the N most recent `featured: true` projects, full stop.
- `standing` is new: a short tag naming which §1 credential the project demonstrates
  ("DOD-funded capstone," "production ordering-site build," "career-transition portfolio piece"). Used
  on `/about/` and `/work-with-me/` to cite specific projects instead of vague claims — directly
  supports §8 ("when I have one data point, I say the exact project, its scale...").

Existing frontmatter with `industry:` needs a find-and-replace to `domain:` as part of Phase 4's
content pass (only `order-intake-mini-crm-template.md` currently sets it).

## Component-level IA changes

- **`RealEstateSolutions.astro`** — retire. If the home page still wants a "recent work" teaser
  section, replace with a generic version that has no vertical framing and pulls from `featured`
  projects site-wide (no `industry` filter). Decide in Phase 1 (see migration plan open items).
- **`work-with-me.astro` (new)** — structurally similar to the current `about.astro` (prose section +
  closing CTA), but its entire job is the pitch: what you do, for whom, proof points pulled via
  `standing`-tagged projects, and a CTA into `/contact/`. This is the one page where sales framing is
  appropriate — it's opt-in by the visitor navigating there, not the site's front door.
- **`about.astro`** — no longer needs to double as a pitch. Becomes pure §1 standing: credentials,
  what you don't claim expertise in (§1's explicit non-standing list), and a pointer to `/work-with-me/`
  for anyone who wants to hire you, rather than trying to close the sale itself.
