# Agents

Two subagents, purpose-built for this site's editorial workflow. (This directory used to hold a
generic 34-agent "product studio" pack — mobile app builders, TikTok strategists, finance trackers —
none of which fit a solo content site. Trimmed 2026-07-29.)

| Agent | Purpose |
|---|---|
| `content-editor` | Reviews a draft against `brand-brief.md` and `docs/design/voice-guide.md`; reports specific violations with fixes. Read-only by default — only edits when explicitly asked to apply fixes. |
| `content-researcher` | Grounds a new project writeup in real facts pulled from its actual repo, a PDF/paper, and/or its live URL — so posts cite real numbers instead of plausible-sounding invention. Research only, never writes the post itself. |

See `CLAUDE.md` (repo root) for the full content workflow these fit into, and
`.claude/skills/new-post/` / `.claude/skills/publish-check/` for the skills that use them.
