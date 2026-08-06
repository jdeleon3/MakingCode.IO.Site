---
title: 'Auditing 25 GitHub Repositories with Claude'
description: 'How I used Claude in Chrome to audit 25 repos, spot clutter, and generate batch PowerShell scripts to clean up my GitHub profile.'
pubDate: 2026-08-04
heroImage: '../../assets/blog/github_cleanup_hero.png'
tags: ['github', 'claude', 'ai-tools', 'workflow']
#draft: true
---

My GitHub account had accumulated 25 repositories over several years. It was a mix of active projects, class assignments from my master's coursework, half-finished prototypes, and old tutorial stubs like `helloGit` and `HelloNetlify`. As part of building out this site and deliberately applying AI tools to real engineering workflows, I wanted to audit and organize the account. But manually clicking through 25 repository settings pages to edit descriptions, topics, and visibilities sounded like tedious administrative overhead.

Instead of spending an afternoon on manual UI navigation, I used Claude in Chrome to audit the entire account and generate a batch action plan.

![GitHub profile overview before cleanup showing 25 unorganized repositories](/images/blog/auditing-25-github-repos-with-claude/profile-before.png)

## The tool setup and the exact prompt

Claude didn't have a direct API connection to my GitHub account. Rather than setting up personal access tokens or custom script integrations for a one-off task, I used Claude's Chrome browser integration. The extension allows Claude to inspect live browser pages, navigate repository tabs, open directory trees, and read `README.md` files directly in the browser.

I opened my profile URL (`github.com/jdeleon3`) in Chrome and ran this prompt:

```text
Hey Claude. I'd like to evaluate the state of my github repositories. I want to figure out which ones I should keep, which to delete, which ones to work on and fix. Help me get things in order. Ask any clarifying questions as you review my github. We are only doing an evaluation at this point. Here's the link: https://github.com/jdeleon3
```

When Claude asked clarifying questions to weight the recommendations, I specified two constraints: the primary goal was organizing the profile to highlight real engineering work, and the execution should be planned for a single focused session.

## Spot-checking and verification

Rather than making blind assumptions from repository names, Claude inspected file structures and surfaced ambiguous cases for human review:

- **`netlify-blog`**: Claude flagged this as a Next.js/MDX template clone with Bejamas boilerplate and asked whether it was an active blog or an unused clone. I confirmed it was an unused template, moving it straight to the deletion bucket.
- **`aws-rss-reader-ui`**: Claude noticed `aws-rss-reader` had a full backend spec, while `aws-rss-reader-ui` was an untouched Vite template. It asked if the UI was functional or stalled. I confirmed it was scaffolded and stalled, tagging it as a work-in-progress to document alongside the backend.

Having the LLM ask before categorizing prevented deleting repositories that looked like tutorial stubs but contained custom logic.

## The audit breakdown

In a single session, Claude categorized all 25 repositories into four action buckets:

1. **Keep (active or portfolio-solid, no action needed)**: `MakingCode.IO.Site`, `MakingCode.IO.ContentPipeline`, `RD.Creations.Site`, `Projects.RealFakeJobPredictor`, and `ImageProcessing.BackgroundReplace` (five repos with recent pushes, real stars, or both).
2. **Delete 9 dead-weight repos**: Flagged zero-byte tutorial clones (`helloGit`, `HelloNetlify`, `HelloPython`), `netlify-blog` (an unused template clone, added to this bucket from the spot-check confirmation above rather than the initial pass), and abandoned stubs (`coursera-java-fundamentals`, `azurestaticwebappwithvue`, `Graduate.Work`, `Projects.Infrastructure.ExplainableAnomalyDetection`, `Projects.ExplainableNetworkMonitoring`).
3. **Fix missing metadata on 8 repos**: Identified repos with real code but blank descriptions: `rag-saas-mvp`, `Projects.Movies.ReviewSentimentAnalysis`, `aws-rss-reader`, `aws-rss-reader-ui` (the same stalled scaffold flagged during spot-checking, back again here because a stalled repo still needs an honest description), `aws-lambda-siteCrawler`, and the three Data Mining repos (`Datamining.Classification.TumorType`, `Datamining.Classification.CustomerSegmentation`, `Datamining.Clustering.CreditCardDataset`). Claude drafted custom one-line descriptions and topic tags based on actual directory contents. The eventual script also touched the four Keep-bucket repos and flipped one to private, covered below.
4. **Consolidate duplicates (2 deletions)**: Identified three separate stock trading repositories (`Stock-Swing-Trader`, `Projects.Finance.StockSwingTrader`, `Projects.ExplainableStockPredictions`) and recommended merging them into `Stock-Swing-Trader`, deleting the two redundant stubs.

Five repos landed in Keep, but one of them was a private repository resulting in only four pinned repositories: `Projects.RealFakeJobPredictor`, `ImageProcessing.BackgroundReplace`, `MakingCode.IO.Site`, and `RD.Creations.Site`. `MakingCode.IO.ContentPipeline` stayed a Keep without getting pinned.

![Audit breakdown document generated by Claude categorizing all 25 repositories](/images/blog/auditing-25-github-repos-with-claude/audit-document.png)

## Generating executable PowerShell scripts

Rather than making manual UI edits, Claude output ready-to-run GitHub CLI (`gh`) commands.

One immediate gotcha: Claude formatted multiline commands using Bash line continuation backslashes (`\`). PowerShell has no line-continuation meaning for `\` at all (only the backtick does), so a trailing backslash doesn't continue the command onto the next line. It just ends the line early, and PowerShell parses whatever comes next as a separate, malformed statement.

The next attempt was PowerShell's actual line-continuation character, the backtick. That didn't hold up either: a single invisible trailing space after a backtick silently breaks the continuation. PowerShell doesn't throw a syntax error; it just stops treating the next line as part of the same command, and the failure shows up downstream as a confusing, unrelated-looking error instead of pointing at the real cause. After tripping over that once, I stopped fighting line continuation entirely and had every `gh repo edit` and `gh repo delete` command flattened to a single line. That's what's actually in all three `.ps1` scripts below.

I split the commands into three scripts in my workspace:

`delete_stale_repos.ps1` (deleting 9 dead-weight repos):

```powershell
gh repo delete jdeleon3/helloGit --yes
gh repo delete jdeleon3/HelloNetlify --yes
gh repo delete jdeleon3/HelloPython --yes
gh repo delete jdeleon3/coursera-java-fundamentals --yes
gh repo delete jdeleon3/azurestaticwebappwithvue --yes
gh repo delete jdeleon3/Graduate.Work --yes
gh repo delete jdeleon3/Projects.Infrastructure.ExplainableAnomalyDetection --yes
gh repo delete jdeleon3/Projects.ExplainableNetworkMonitoring --yes
gh repo delete jdeleon3/netlify-blog --yes
```

`consolidate_stock_repos.ps1` (deleting 2 redundant duplicate stubs):

```powershell
gh repo delete jdeleon3/Projects.Finance.StockSwingTrader --yes
gh repo delete jdeleon3/Projects.ExplainableStockPredictions --yes
```

`add_descriptions.ps1` ended up covering more than just the 8 Fix-bucket repos: I also used it to refresh descriptions and topics on the 4 pinned Keep-bucket repos, and to flip `RD.Creations.Site` to private in the same pass. One inconsistency worth flagging: `rag-saas-mvp`'s description below says "Production-ready", whereas the audit table called the same repo stalled at 5 commits. That's the line that actually shipped; I'm not rewriting it for this post. One more note: the visibility change for `RD.Creations.Site` ran as part of this script, but the profile and repo-list screenshots later in this post were captured before that line executed, so they still show it public (a timing artifact, not a contradiction):

```powershell
# --- Descriptions + topics: pinned / Keep repos ---
gh repo edit jdeleon3/MakingCode.IO.Site --description "Content/blog site for the MakingCode.IO brand - Astro on Cloudflare Workers, paired with an AI-assisted content pipeline" --add-topic astro --add-topic cloudflare-workers --add-topic blog

gh repo edit jdeleon3/Projects.RealFakeJobPredictor --description "Full-stack app with an ML core detecting fraudulent job postings - Python/ML backend, AWS CDK infrastructure, and frontend" --add-topic machine-learning --add-topic fraud-detection --add-topic aws-cdk

gh repo edit jdeleon3/ImageProcessing.BackgroundReplace --description "Computer vision app for removing/replacing image backgrounds (color-based and transparency methods) with a UI - CS 6322 grad term project" --add-topic computer-vision --add-topic image-processing --add-topic python

gh repo edit jdeleon3/RD.Creations.Site --description "Order intake site and mini-CRM for RD Creations, a Valley Mills, TX bakery - Astro + Tailwind + Supabase, deployable to Cloudflare Pages or Vercel" --add-topic astro --add-topic supabase --add-topic tailwindcss

gh repo edit jdeleon3/RD.Creations.Site --visibility private

# --- Descriptions + topics: Fix repos ---
gh repo edit jdeleon3/Projects.Movies.ReviewSentimentAnalysis --description "Full-stack movie review sentiment analysis app - Python backend, frontend, and AWS CDK infrastructure" --add-topic sentiment-analysis --add-topic aws-cdk --add-topic nlp

gh repo edit jdeleon3/Datamining.Classification.TumorType --description "Classification pipeline predicting tumor type from clinical data - preprocessing, model training, and visualization" --add-topic classification --add-topic machine-learning --add-topic scikit-learn

gh repo edit jdeleon3/Datamining.Classification.CustomerSegmentation --description "Classification pipeline segmenting customers by behavioral and demographic features" --add-topic classification --add-topic machine-learning

gh repo edit jdeleon3/Datamining.Clustering.CreditCardDataset --description "Clustering analysis on credit card transaction data to identify spending/behavior segments" --add-topic clustering --add-topic unsupervised-learning --add-topic machine-learning

gh repo edit jdeleon3/aws-rss-reader --description "AWS CDK (TypeScript) backend for an RSS aggregator - categorized feeds with on-demand AI summaries" --add-topic aws-cdk --add-topic typescript --add-topic serverless

gh repo edit jdeleon3/aws-rss-reader-ui --description "Vue 3 + Vite frontend for the AWS RSS Reader project (WIP, paired with aws-rss-reader backend)" --add-topic vue --add-topic frontend

gh repo edit jdeleon3/aws-lambda-siteCrawler --description "Java AWS Lambda function for crawling websites, with CI configured via GitHub Actions" --add-topic aws-lambda --add-topic java --add-topic serverless

gh repo edit jdeleon3/rag-saas-mvp --description "Production-ready RAG SaaS MVP - FastAPI + pgvector backend, React frontend, Ollama LLM inference, Docker Compose" --add-topic rag --add-topic fastapi --add-topic llm --add-topic docker
```

![Staging deletion scripts in VS Code terminal before execution](/images/blog/auditing-25-github-repos-with-claude/staged-script.png)

## Human review & CLI permissions

Generating the audit and scripts took roughly 20 minutes. But reviewing the `.ps1` files in VS Code before hitting enter was essential because `gh repo delete` doesn't ask twice, and `delete_stale_repos.ps1` had nine specific repo names on it that I needed to personally confirm before the terminal ever saw them. Generating CLI scripts takes seconds; running `gh repo delete` without checking the target list first is how you delete a repository you actually needed.

During the first run of `delete_stale_repos.ps1`, the GitHub CLI came back with a 403 because the authenticated `gh` session didn't carry the OAuth scope needed to delete repositories.

Standard `gh` CLI credentials omit deletion privileges by default. Requesting the explicit `delete_repo` OAuth scope resolved it:

```bash
gh auth refresh -h github.com -s delete_repo
```

Once re-authenticated, executing `delete_stale_repos.ps1` and `consolidate_stock_repos.ps1` deleted all 11 targeted repositories in seconds:

![Execution output showing batch deletion of stale repositories with green checkmarks](/images/blog/auditing-25-github-repos-with-claude/executed-deletion.png)

## The final result: Reconciling the count

Deleting 9 dead-weight repositories plus 2 redundant stock trading stubs removed 11 repositories total. The account dropped from 25 repositories down to exactly 14 active, clean projects.

![GitHub profile after cleanup showing 14 clean repositories and pinned projects](/images/blog/auditing-25-github-repos-with-claude/profile-after-pinned.png)

The repository list now features single-sentence descriptions and topic tags across all remaining codebases:

![Repositories list after updating metadata and adding topic tags](/images/blog/auditing-25-github-repos-with-claude/repos-after-tags.png)

## Next steps

The audit and batch cleanup cleared out the profile noise, but a few follow-up tasks remain on the backlog:

- **Full README Write-Ups**: Draft documentation for `Projects.Movies.ReviewSentimentAnalysis` and `aws-lambda-siteCrawler`, which both contain substantial code but zero documentation.
- **`rag-saas-mvp` Direction**: Decide whether to continue active development on the RAG SaaS MVP (FastAPI + pgvector + Docker) or publish it publicly with an explicit status note indicating it is a completed MVP snapshot.
- **Coursework Consolidation**: Bundle the three separate Data Mining repositories (`Datamining.Classification.TumorType`, `Datamining.Classification.CustomerSegmentation`, `Datamining.Clustering.CreditCardDataset`) into a single `ML-Coursework` repository with a unified README summarizing each dataset and technique.

If you've run a similar cleanup pass on your own GitHub account, reply and tell me what your audit turned up.
