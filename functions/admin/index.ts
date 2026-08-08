import { requireAdmin, escapeHtml, type AdminEnv } from './_shared';

interface AdminCommentRow {
  id: string;
  post_slug: string;
  author_name: string;
  author_email: string;
  body: string;
  status: string;
  created_at: string;
  moderated_at: string | null;
}

const RECENT_LIMIT = 25;

const PAGE_STYLES = `
  :root {
    --surface: #0a0b0d; --raised: #15171b; --ink: #ece7dd; --muted: #8d8d86;
    --accent: #259ae8; --border: #26282d; --danger: #e0575b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--surface); color: var(--ink); line-height: 1.6;
    font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 52rem; margin: 0 auto; padding: 3rem 1.5rem 6rem; }
  .label {
    font-family: ui-monospace, 'IBM Plex Mono', monospace; font-size: 0.6875rem;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent);
  }
  h1 { font-size: 1.75rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
  h2 { font-size: 1rem; font-weight: 600; margin: 3rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
  .sub { color: var(--muted); font-size: 0.875rem; margin: 0 0 2rem; }
  .card { border: 1px solid var(--border); background: var(--raised); padding: 1.25rem; margin-bottom: 1rem; }
  .meta {
    font-family: ui-monospace, 'IBM Plex Mono', monospace; font-size: 0.6875rem;
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
    display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;
  }
  .meta .who { color: var(--ink); }
  .body { white-space: pre-wrap; word-break: break-word; margin: 0 0 1rem; font-size: 0.9375rem; }
  .actions { display: flex; gap: 0.5rem; }
  button {
    font-family: ui-monospace, 'IBM Plex Mono', monospace; font-size: 0.6875rem;
    letter-spacing: 0.08em; text-transform: uppercase; padding: 0.6rem 1.25rem;
    border: 1px solid var(--border); background: transparent; color: var(--ink); cursor: pointer;
  }
  button.approve { background: var(--accent); border-color: var(--accent); color: var(--surface); }
  button.reject:hover { border-color: var(--danger); color: var(--danger); }
  .empty { color: var(--muted); font-size: 0.9375rem; }
  .pill {
    font-family: ui-monospace, 'IBM Plex Mono', monospace; font-size: 0.625rem;
    padding: 0.15rem 0.5rem; border: 1px solid currentColor; text-transform: uppercase;
  }
  .pill.approved { color: var(--accent); }
  .pill.rejected { color: var(--danger); }
  a { color: var(--accent); }
`;

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.valueOf()) ? iso : parsed.toISOString().replace('T', ' ').slice(0, 16);
}

function pendingCard(row: AdminCommentRow): string {
  return `
    <article class="card">
      <div class="meta">
        <span class="who">${escapeHtml(row.author_name)}</span>
        <span>${escapeHtml(row.author_email)}</span>
        <span>${formatDate(row.created_at)}</span>
        <span><a href="/blog/${encodeURIComponent(row.post_slug)}/" target="_blank" rel="noreferrer">${escapeHtml(row.post_slug)}</a></span>
      </div>
      <p class="body">${escapeHtml(row.body)}</p>
      <div class="actions">
        <form method="post" action="/admin">
          <input type="hidden" name="id" value="${escapeHtml(row.id)}" />
          <input type="hidden" name="action" value="approve" />
          <button class="approve" type="submit">Approve</button>
        </form>
        <form method="post" action="/admin">
          <input type="hidden" name="id" value="${escapeHtml(row.id)}" />
          <input type="hidden" name="action" value="reject" />
          <button class="reject" type="submit">Reject</button>
        </form>
      </div>
    </article>`;
}

function moderatedCard(row: AdminCommentRow): string {
  const reverseAction = row.status === 'approved' ? 'reject' : 'approve';
  return `
    <article class="card">
      <div class="meta">
        <span class="pill ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
        <span class="who">${escapeHtml(row.author_name)}</span>
        <span>${escapeHtml(row.post_slug)}</span>
        <span>${row.moderated_at ? formatDate(row.moderated_at) : formatDate(row.created_at)}</span>
      </div>
      <p class="body">${escapeHtml(row.body)}</p>
      <div class="actions">
        <form method="post" action="/admin">
          <input type="hidden" name="id" value="${escapeHtml(row.id)}" />
          <input type="hidden" name="action" value="${reverseAction}" />
          <button type="submit">Change to ${reverseAction}d</button>
        </form>
      </div>
    </article>`;
}

/**
 * Comment moderation queue. Replaces the Supabase table editor that the hosted-Supabase setup
 * relied on — see docs/design/comments-system.md.
 *
 * GET renders the queue and POST applies a decision, deliberately on the *same* path. Cloudflare
 * Access matches paths exactly unless you wildcard: a Path of `admin` covers `/admin` only, while
 * `admin/*` covers `/admin/moderate` but not `/admin`. Splitting the actions across two URLs would
 * mean either two Access applications or a wildcard that silently leaves one of them uncovered.
 * One route, one path to protect, no way to get the policy subtly wrong.
 */
export const onRequestGet: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const [pending, moderated] = await Promise.all([
    env.DB.prepare(
      `select id, post_slug, author_name, author_email, body, status, created_at, moderated_at
         from comments where status = 'pending' order by created_at asc`,
    ).all<AdminCommentRow>(),
    env.DB.prepare(
      `select id, post_slug, author_name, author_email, body, status, created_at, moderated_at
         from comments where status != 'pending' order by coalesce(moderated_at, created_at) desc limit ?`,
    )
      .bind(RECENT_LIMIT)
      .all<AdminCommentRow>(),
  ]);

  const pendingRows = pending.results ?? [];
  const moderatedRows = moderated.results ?? [];

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Comment moderation — MakingCode</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <div class="wrap">
    <span class="label">Moderation</span>
    <h1>Comments</h1>
    <p class="sub">${pendingRows.length} ${pendingRows.length === 1 ? 'reply' : 'replies'} waiting · approved comments appear on the post within a minute.</p>

    <h2>Pending</h2>
    ${pendingRows.length ? pendingRows.map(pendingCard).join('') : '<p class="empty">Nothing waiting.</p>'}

    <h2>Recently moderated</h2>
    ${moderatedRows.length ? moderatedRows.map(moderatedCard).join('') : '<p class="empty">Nothing moderated yet.</p>'}
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};

const ACTIONS = { approve: 'approved', reject: 'rejected' } as const;

function isAction(value: unknown): value is keyof typeof ACTIONS {
  return value === 'approve' || value === 'reject';
}

/**
 * Applies a moderation decision and sends the browser back to the queue.
 *
 * Plain form POST + 303 rather than fetch/JSON: this page has exactly one job, and a redirect means
 * a refresh after acting doesn't resubmit.
 */
export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const form = await request.formData();
  const id = form.get('id');
  const action = form.get('action');

  if (typeof id !== 'string' || !id || !isAction(action)) {
    return new Response('Bad moderation request.', { status: 400 });
  }

  try {
    await env.DB.prepare('update comments set status = ?, moderated_at = ? where id = ?')
      .bind(ACTIONS[action], new Date().toISOString(), id)
      .run();
  } catch (error) {
    console.error('D1 moderation update error:', error);
    return new Response('Unable to update that comment.', { status: 502 });
  }

  return new Response(null, { status: 303, headers: { location: '/admin' } });
};
