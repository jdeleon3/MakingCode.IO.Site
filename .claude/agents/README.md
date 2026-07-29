# Multi-Agent Studio System

This directory contains **34 specialist subagents** for Claude Code, organized into 7
departments that mirror a small product studio. Each `.md` file is a self-contained
subagent definition (YAML frontmatter + system prompt) that Claude Code can invoke
automatically or on request.

## Departments

| Folder | Agents | Purpose |
|---|---|---|
| `engineering/` | frontend-developer, backend-architect, mobile-app-builder, ai-engineer, devops-automator, rapid-prototyper | Building and shipping software |
| `product/` | trend-researcher, feedback-synthesizer, sprint-prioritizer | Deciding what to build |
| `marketing/` | tiktok-strategist, instagram-curator, twitter-engager, reddit-community-builder, app-store-optimizer, content-creator, growth-hacker | Getting the word out |
| `design/` | ui-designer, ux-researcher, brand-guardian, visual-storyteller, whimsy-injector | How it looks and feels |
| `project-management/` | experiment-tracker, project-shipper, studio-producer | Keeping work moving |
| `studio-operations/` | support-responder, analytics-reporter, infrastructure-maintainer, legal-compliance-checker, finance-tracker | Running the business day-to-day |
| `testing/` | tool-evaluator, api-tester, workflow-optimizer, performance-benchmarker, test-results-analyzer | Quality and performance |

See `GETTING_STARTED.md` (one level up, at the project root) for installation
and a first end-to-end example.
