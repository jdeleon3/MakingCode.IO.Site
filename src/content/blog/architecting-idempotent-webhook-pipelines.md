---
title: 'Architecting Idempotent Webhook Pipelines'
description: 'Why "at-least-once" delivery breaks naive CRM integrations, and the idempotency-key pattern that fixes it for good.'
pubDate: 2026-05-18
updatedDate: 2026-06-02
heroImage: '../../assets/blog/webhook-pipelines.jpg'
tags: ['architecture', 'automation', 'reliability']
---

Most CRM and payment providers guarantee **at-least-once** webhook delivery, not exactly-once. If your system assumes every webhook arrives exactly one time, you will eventually double-book an appointment, double-charge a client, or double-notify an agent. This is the architectural trade-off at the center of every serious automation build: correctness under retries costs a little extra state, but the alternative costs trust.

## The trade-off

There are three common strategies, in increasing order of robustness and cost:

1. **Do nothing** — cheapest, breaks in production the first time a provider retries after a slow 200.
2. **Timestamp/window de-duplication** — cheap, but fragile around clock skew and burst retries.
3. **Idempotency-key ledger** — a small persisted table keyed on the provider's event ID, checked before any side effect runs.

For anything touching money, scheduling, or client communication, option 3 is the only defensible choice.

## Implementation: the idempotency-key middleware

```typescript
import type { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

interface WebhookEvent {
  id: string;
  type: string;
  payload: unknown;
}

export function idempotencyGuard(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const event = req.body as WebhookEvent;

    const { rowCount } = await pool.query(
      `INSERT INTO webhook_events (event_id, event_type, received_at)
       VALUES ($1, $2, now())
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type],
    );

    if (rowCount === 0) {
      // Already processed this exact event ID — ack without re-running side effects.
      res.status(200).json({ status: 'duplicate_ignored' });
      return;
    }

    next();
  };
}
```

The `ON CONFLICT DO NOTHING` clause is doing the real work here: the uniqueness constraint on `event_id` turns a race between two concurrent retries into a no-op for the loser, with no explicit locking required.

## Queueing the guarded events

Once an event passes the guard, it's handed to a durable queue rather than processed inline — so a downstream failure (CRM API timeout, rate limit) doesn't force the webhook endpoint itself to block or fail:

```yaml
# consumer-config.yaml
queue:
  name: webhook-events
  visibility_timeout_seconds: 30
  max_receive_count: 5
  dead_letter_queue: webhook-events-dlq

consumer:
  concurrency: 10
  backoff:
    strategy: exponential
    base_ms: 500
    max_ms: 30000
```

## Verifying the fix

Replaying a captured webhook payload against a local instance confirms the guard behaves correctly under a simulated retry:

```bash
# First delivery — should process normally
curl -X POST http://localhost:8787/webhooks/crm \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_9f8a1c","type":"lead.created","payload":{}}'

# Simulated retry of the same event — should be ignored, not reprocessed
curl -X POST http://localhost:8787/webhooks/crm \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_9f8a1c","type":"lead.created","payload":{}}'
```

If the second call returns `duplicate_ignored` and no second side effect fires, the ledger is doing its job. This same pattern — a small keyed table in front of anything with a side effect — is the backbone of every reliable automation pipeline we ship, regardless of which CRM or messaging provider sits on the other end.
