---
title: 'Real Estate Lead Routing Automation'
description: 'A tactical breakdown of an automated lead-scoring and routing system that cut agent response time from hours to minutes across a 40-agent brokerage.'
pubDate: 2026-03-10
updatedDate: 2026-04-22
heroImage: '/images/projects/lead-routing.jpg'
tags: ['real-estate', 'workflow-automation', 'integrations']
industry: 'Real Estate'
techStack: ['TypeScript', 'n8n', 'Twilio', 'Airtable', 'PostgreSQL']
impact: 'Reduced average lead response time from 4 hours to under 2 minutes across 40+ agents.'
featured: true
---

A regional brokerage was losing deals to faster-moving competitors — not on price or service, but on **response time**. Leads from Zillow, the brokerage site, and open-house sign-ins sat in a shared inbox for hours before a human triaged them to an agent. By the time contact happened, the lead had already spoken to someone else.

## Problem

- Leads arrived from 4 different sources with inconsistent fields.
- Routing was manual: an office manager read each lead and picked an agent by gut feel.
- No scoring — a "just browsing" form-fill got the same priority as a pre-approved buyer ready to tour.

## Architecture

The system ingests leads through a single normalized webhook, scores them, and routes to the right agent's phone within seconds — no human in the loop for the common case.

```typescript
interface RawLead {
  source: 'zillow' | 'site_form' | 'open_house' | 'referral';
  budget?: number;
  preApproved?: boolean;
  timeframeDays?: number;
  message?: string;
}

interface ScoredLead extends RawLead {
  score: number;
  tier: 'hot' | 'warm' | 'cold';
}

function scoreLead(lead: RawLead): ScoredLead {
  let score = 0;

  if (lead.preApproved) score += 40;
  if (lead.budget && lead.budget > 500_000) score += 20;
  if (lead.timeframeDays !== undefined && lead.timeframeDays <= 30) score += 30;
  if (lead.source === 'open_house') score += 10;

  const tier: ScoredLead['tier'] = score >= 60 ? 'hot' : score >= 30 ? 'warm' : 'cold';

  return { ...lead, score, tier };
}

function routeLead(lead: ScoredLead, roster: AgentRosterEntry[]): AgentRosterEntry {
  // Hot leads always go to the top-performing available agent;
  // warm/cold leads round-robin to keep the roster balanced.
  const pool = lead.tier === 'hot'
    ? roster.filter((a) => a.available).sort((a, b) => b.closeRate - a.closeRate)
    : roster.filter((a) => a.available);

  return pool[0];
}

interface AgentRosterEntry {
  id: string;
  available: boolean;
  closeRate: number;
}
```

## Workflow orchestration

The scoring function above runs inside an n8n workflow that owns the end-to-end sequence: normalize → score → route → notify → log.

```yaml
# lead-routing-workflow.yaml
trigger:
  type: webhook
  path: /leads/intake

steps:
  - name: normalize-source-payload
    type: function
    handler: normalizeLead

  - name: score-and-tier
    type: function
    handler: scoreLead

  - name: lookup-available-agent
    type: airtable-query
    table: AgentRoster
    filter: "{Available} = TRUE()"

  - name: route-lead
    type: function
    handler: routeLead

  - name: notify-agent
    type: twilio-sms
    to: "{{ $node.route-lead.json.agent.phone }}"
    body: "New {{ $node.score-and-tier.json.tier }} lead: {{ $node.normalize-source-payload.json.name }} — {{ $node.normalize-source-payload.json.message }}"

  - name: log-to-postgres
    type: postgres-insert
    table: lead_events
```

## Deployment

The workflow runs on a small always-on n8n instance, with a nightly cron reconciling any leads that failed notification (e.g. an agent's number bounced) back into a manual-review queue instead of silently dropping them:

```bash
# Deploy the workflow definition
n8n import:workflow --input=lead-routing-workflow.yaml

# Nightly reconciliation job — catches failed-notification leads
crontab -l | { cat; echo "0 6 * * * n8n execute --id reconcile-failed-leads"; } | crontab -
```

## Outcome

Average first-contact time dropped from **4 hours to under 2 minutes**, and hot leads are now routed to the brokerage's highest closers automatically instead of whoever happened to be near the shared inbox. The same scoring-and-routing shape — normalize, score, route, notify, log — has since been reused for two other brokerages with different CRMs and messaging providers, swapping only the integration adapters at the edges.
