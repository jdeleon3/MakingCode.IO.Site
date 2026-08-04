---
title: 'Building the Content Engine: An AI-Directed Pipeline for Writing About My Own Work'
description: 'A tactical breakdown of `ce`, the pipeline I built in three days to turn a finished project''s git history and voice memos into a grounded, voice-matched draft, including this post as its first real run.'
pubDate: 2026-07-30
heroImage: '../../assets/projects/content-engine-v2.png'
tags: ['automation', 'ai-assisted-development', 'python', 'content-pipeline']
domain: 'AI-Assisted Development Tooling'
standing: 'Solo build, directed end to end: requirements interview, design review, and code review on every work package, not "AI wrote it"'
techStack:
  [
    'Python 3.11',
    'Claude (Opus 5 / Sonnet 5 / Haiku 4.5)',
    'Typer',
    'Pydantic v2',
    'SQLite',
    'gitleaks',
    'FastAPI + HTMX',
    'Playwright',
    'Mermaid CLI',
    'OpenAI (transcription + embeddings)',
  ]
impact: 'Replaced years of stalled "I should really write about this" attempts with a repeatable pipeline. Git history and voice memos in, a grounded draft out. This post is its first real run, using notes from building itself.'
featured: true
---

I've tried to start this blog for years, off and on, and the place it always stalled was the writing itself, not the building. I'd finish something, tell myself I'd write it up, and never do it.

Then I saw Sabrina Ramonov's content on Facebook and YouTube about Blotato, her tool for automating social posts with AI. The pitch was appealing. My worry was specific: hand the writing fully to AI and the result stops sounding like me. That pushed me toward building my own version instead of buying hers: AI does the first 80%, but the input comes from real notes on real work, leaving the final 20% for me.

`ce` is that pipeline ([source code on GitHub](https://github.com/jdeleon3/MakingCode.IO.ContentPipeline)). Here's how it's built, how it actually got built, and an honest review of where it stands.

## What I built

```
SELECT  →  BUILD  →  HARVEST  →  PRODUCE  →  SHIP
(human)    (human)   (auto)      (mixed)     (human)
```

I select a project that I want to create or explore. As I build, I record short voice memos while something is going wrong, while the specifics are still fresh, rather than after. `ce harvest` pulls git history for that project, transcribes the memos, runs external research, and produces several candidate briefs for me to choose from.

`ce produce` drafts it, grades it, and revises until it clears the bar, then stops for my edit. `ce verify` checks every factual claim against source. `ce assets` and `ce render` build the diagrams, thumbnails, and per-platform copy. `ce package` writes a self-contained `REVIEW.html` I read through before posting.

Two things stayed non-negotiable the entire build:

- **A repo allowlist (G1).** A project not explicitly listed in `config/engine.yml` is invisible to the pipeline. Default deny.
- **A secret scan (G2).** `gitleaks` runs over every commit range before anything reaches a model, along with a path denylist. Raw diffs are never sent to an LLM; only commit messages, file paths, and line counts are sent.

Both gates are hard-coded to `hard_fail` and can't be bypassed, not even with `--force`. Publishing to LinkedIn, Facebook, and YouTube is manual by design. The engine builds the package, then I post it and paste the URLs back. Skipping OAuth, platform API audits, and token refresh entirely was the goal.

![ce doctor Environment & Dependency Check](/images/projects/content-engine/ce-doctor-env-check.png)

## How it actually got built

This was fully AI-directed, not AI-assisted in the token sense of autocomplete. I started with an interview-style requirements session with Claude, back and forth until the scope was actually clear. That produced a technical design doc and a work plan, WP-00 through WP-18. Once I approved the design, Claude implemented work packages one at a time. I did the code review and testing on each one; when I found an issue, Claude fixed it, unless I was out of tokens for the day, in which case I fixed it myself. I owned making sure the real integrations (Anthropic, OpenAI, gitleaks, and the site repo itself) actually connected and worked, keeping Claude in an assistant role for that phase.

![AI-Directed Requirements Interview Prompt](/images/projects/content-engine/interview-prompt.png)

WP-17 through WP-22 were added later, after the CLI was functional, specifically to bolt on a GUI. (More on why below.)

The real numbers: 27 commits from 2026-07-27 to 2026-07-29, three calendar days, built in evenings into early morning hours around a day job. 23 work packages shipped. 541 tests passing with one pre-existing skip. 61 Python files under `src/ce`. Every work package has its acceptance criteria and test count logged in `STATUS.md` before the next one starts. That log is why I can cite these numbers instead of guessing.

![CLI Test Suite Execution & Debugging](/images/projects/content-engine/cli-test-suite-debugging.png)

## The architecture, briefly

**LLM gateway.** Three model tiers handle different responsibilities: Opus 5 for reasoning-heavy work (briefs, grading), Sonnet 5 for drafting and renditions, Haiku 4.5 for cheap classification and cleanup. A budget governor caps spend at $20/month and $2/run, configured to `halt` rather than silently degrade when exceeded.

To enforce this, every API call is audited and logged in a local SQLite ledger (`data/ledger.jsonl`), tracking per-process token counts and monetary spend across each stage:

![LLM Token Cost Ledger Breakdown per Process](/images/projects/content-engine/llm-costs-table.png)

Cross-referencing against Anthropic's daily usage console confirms a billed single-article run cost of ~$0.87 across all model tiers:

![Anthropic Console Billed Daily Token Usage Chart](/images/projects/content-engine/anthropic-token-cost-chart.png)

**Harvest.** Git extraction, transcription, and external research run behind G1/G2, then feed a dedupe index (SQLite plus brute-force cosine similarity over embeddings at a 0.88 threshold over a 365-day scope) so the same story doesn't get generated twice.

**Produce.** A draft/grade/revise loop that stops once a piece scores, then a separate claim-verification gate (`ce verify`) that checks factual claims against the harvested source before a piece is allowed through.

![Draft-Grade-Revise Loop and Claim Verification Gate Flowchart](/images/projects/content-engine/produce-verify-loop.png)

**Package and ship.** `ce package` assembles a self-contained `REVIEW.html` with a manual checklist, including a deliberate, accepted gap: screenshots aren't automatically scanned for secrets, since nothing catches a token sitting in terminal scrollback the way `gitleaks` catches one in a diff. `ce publish site` writes straight into this site's `src/content/blog/`. One real bug surfaced and got fixed here: the first version only copied and path-rewrote the hero image, leaving any inline body images pointing at broken paths. I fixed this by extending the rewrite logic to every body image and raising a hard `PublishError` if a referenced file is missing. The issue was caught by testing against this repo directly rather than leaving it for a live post to expose.

## The operator console

Claude's initial architectural recommendation was CLI-first. However, for a daily workflow tool, I prefer a visual console over typing terminal commands for every step. WP-17 through WP-22 added a server-rendered FastAPI + HTMX web application layered directly on top of the CLI commands rather than building a second parallel implementation.

The console provides a top-level dashboard of all active builds and a historical run log to maintain transparency over background execution. But the most critical view is the individual piece detail. This panel displays the raw markdown draft alongside an interactive Opus 5 grade breakdown radar chart, evaluating Hook, Evidence, Specificity, Voice, and CTA scores across revision attempts, serving as visual proof of the draft-grade-revise loop in action:

![Content Engine Piece Detail, Article Editor, and Radar Grade Breakdown](/images/projects/content-engine/gui-screen-piece-detail-dark.png)

## The honest review

This is a v1, and I'm treating it like one.

The good: the requirements-and-design-first approach (a real `CLAUDE.md`, an interview before writing code, a written technical design doc, and a work plan Claude built against) is why a system this scoped came together in three days instead of stalling. That was the biggest surprise of the build: not that AI could write the code, but how much front-loading the requirements work mattered for the end result.

The rough edges, named specifically rather than smoothed over:

- **Asset generation didn't land the way I expected.** The diagram/thumbnail pipeline works, but the actual output quality fell short of what I pictured. I don't have a fix designed yet, just the observation.
- **There's an unresolved bug in `ce harvest`.** `brief_generate` can crash on schema validation for a `video_walkthrough` candidate missing `target_platforms`, even after its built-in repair retry. I've reproduced it twice in a row against this project's harvest run. It doesn't corrupt anything (git and research data refresh before the crash), but new captures since the last successful harvest don't make it into a brief.
- **YouTube is unbuilt in practice.** The metrics and post-back plumbing (WP-15) exist, but I haven't worked through that platform yet. That is a deliberate later phase, not an overlooked gap.
- **Right now, this pipeline can only write about itself.** `config/engine.yml`'s G1 allowlist has exactly one entry: Content Engine's own repo. This post proves the loop closes: real git history and voice memos from building `ce`, processed through `ce`, then reviewed and edited by me. Every other finished project needs to be added to that allowlist before I can write it up.

### What I'd do differently

Push back sooner on a structural recommendation that conflicts with my workflow. I let Claude's CLI-first default stand longer than I should have, then spent a full extra phase (WP-17 through WP-22) adding what I wanted from the start. The lesson isn't "don't trust the model's architecture calls" (most were right). It's "when a recommendation contradicts a clear preference, say so before approving the design, not after."

## Lessons learned

**The role shift is real.** This was my first time fully embracing AI-directed development, and the adjustment wasn't technical. I barely wrote code. Light edits to save tokens, but otherwise my job was planning, reviewing, and catching what the model missed. That sounds easy until you're mid-feature, you see exactly what line needs to change, and you have to stop yourself from just writing it.

**The 80/20 split landed in requirements, not implementation.** I assumed AI would scaffold the code and I'd spend my 20% fixing implementation gaps. In practice, the code was solid, but the requirement translation drifted. The asset pipeline is the best example: I wanted a module to help me place screenshots and screen recordings I had already captured manually. Instead, the model built a complete image-generation pipeline using external APIs. It was impressive, functional code that solved the completely wrong problem. My 20% wasn't fixing bugs; it was catching those design drifts, questioning architectural decisions, and doing the final QA that automated tests can't cover.

The build had a natural rhythm of bursts (reviewing Claude's output, approving, testing) followed by lulls (waiting for it to finish). The dangerous part is the momentum. When work packages are getting checked off, it's easy to say "just one more." My five-hour token quota forced me to stop, and in hindsight that was a good thing. The sessions where I pushed to the edge of my quota were the ones where I didn't review as carefully. Same trap as coding at 2am yourself: the quality of your judgment drops before you notice. Token limits turned out to be an accidental feature, not a constraint.

The voice RAG system met my expectations given the small sample corpus, but one persistent issue stood out: the model kept inserting stacked em dashes despite the voice guide calling them out explicitly. It only stopped when I flagged each instance directly rather than relying on the style document. Guardrails reduce errors but don't eliminate them. I'm responsible for what gets shipped, not the model.

I used Claude to help write `CLAUDE.md`, structure the work packages, and define the requirements interview format (that's the screenshot earlier in this post). If you're not sure how to configure your AI tooling, explain your goal and ask the model to help you set it up. Using AI to configure your AI workflow sounds circular, but it works.

The single biggest takeaway: you learn by building, not by watching. I could have read ten more articles about AI-directed development and still not understood the role shift, the pacing, or the review discipline it requires. Find a project, build it, reflect on what worked and what didn't. Do better next time.

## What I haven't tested beyond this

One operator, one project, three days of source material. I don't know yet how the dedupe threshold or the grading loop hold up against a backlog of a dozen older projects instead of the one it was built on, or whether the $2/run budget cap is realistic once briefs are being generated from real harvests instead of test fixtures. Those are the boundaries this system hasn't been pushed against yet.

## What's next

I'm adding real projects to the allowlist over the next few weeks and using `ce` for actual posts. That will surface a real defect backlog (starting with the `brief_generate` crash and asset pipeline improvements) that hasn't shown up on this initial run.

I also plan to test [Blotato](https://blotato.com) using their 7-day trial to benchmark an off-the-shelf commercial tool directly against this custom pipeline. That comparison will help evaluate where a turnkey SaaS shines versus where local voice matching and strict security gates remain essential.