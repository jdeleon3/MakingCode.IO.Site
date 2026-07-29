---
name: new-post
description: Scaffolds a new blog post or project writeup for MakingCode.io with correct frontmatter, defaulting to draft so nothing goes live by accident. Use when the user wants to start a new post/project, e.g. "/new-post", "start a new blog post about X", "scaffold a project writeup for Y".
---

# New Post

Creates a new markdown file in `src/content/blog/` or `src/content/projects/`, with frontmatter that
matches the live schema in `src/content.config.ts` exactly — don't guess the schema, read that file
first if it's not already in context, since fields have changed over time (`domain`/`standing` replaced
an older `industry`/`featured`-only shape; both collections now have `draft`).

## Steps

1. **Determine type and slug.** Ask (or infer from the request) whether this is a `blog` post or a
   `projects` writeup, and a working title. Derive the filename slug as kebab-case from the title
   (e.g. "Securing the Webhook Queue" → `securing-the-webhook-queue.md`). Confirm the slug with the
   user if it's not obvious — it becomes the URL and the `post_slug` used by the comments system, and
   is annoying to change later.

2. **Generate frontmatter.** Read `src/content.config.ts` for the current schema, then fill in:
   - `title`, `description` — description should already read like real ad copy per
     `brand-brief.md` §6, not a placeholder ("TODO" descriptions have shipped before; don't repeat
     that).
   - `pubDate` — today's date, unless the user wants this scheduled for a specific future date (see
     `docs/design/voice-guide.md` and `CLAUDE.md`'s scheduling section for what "scheduled" actually
     means on this static site — it is not fully automatic).
   - `tags` — a short array, lowercase-kebab, matching the style already used across existing content
     (check a couple of existing posts for the current tag vocabulary rather than inventing new ones
     where an existing tag fits).
   - `draft: true` — **always default to true for a new scaffold.** This is the whole point of
     scaffolding through this skill instead of hand-writing frontmatter: nothing goes live until
     someone deliberately flips it.
   - For `projects` only: `domain`, `techStack`, `impact`, `featured` (default `false`), `standing`
     (only set if this project genuinely demonstrates a `brand-brief.md` §1 credential — leave unset
     otherwise, don't force one).

3. **Write the file** with the frontmatter above and a short placeholder body — a one-line opening
   sentence stub is enough, not a filled-in draft. Don't write the actual content unless the user
   explicitly asks for that in the same request; scaffolding and drafting are different jobs.

4. **Tell the user what's next**, concretely:
   - Draft the actual content (they may want to hand you real source material first — see the
     `content-researcher` agent if this is a project writeup that needs grounding in a real repo/PDF/
     live site rather than being written from memory).
   - Run the `content-editor` agent (or the `publish-check` skill, which includes the same checks)
     before flipping `draft: false`.
   - Remember: flipping `draft: false` and pushing to `master` is what actually publishes it —
     Cloudflare Pages auto-deploys on push. There's no separate "publish" button.
