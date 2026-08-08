import { json } from '../_lib/http';

interface Env {
  DB: D1Database;
}

interface CommentRow {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

const MAX_SLUG_LENGTH = 200;

/**
 * Public read path for approved comments on one post.
 *
 * Replaces the browser's direct Supabase query. Under RLS the anon key was safe to ship to the
 * client, but it still meant loading the whole Supabase SDK and exposing a key; here the browser
 * sees a plain JSON endpoint and the database is unreachable except through this Function.
 *
 * `author_email` and `ip_hash` are never selected — they cannot leak through a column the query
 * doesn't ask for.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = new URL(context.request.url).searchParams.get('slug')?.trim() ?? '';

  if (!slug || slug.length > MAX_SLUG_LENGTH) {
    return json(400, { ok: false, error: 'A valid slug query parameter is required.' });
  }

  try {
    const { results } = await context.env.DB.prepare(
      `select id, author_name, body, created_at
         from comments
        where post_slug = ? and status = 'approved'
        order by created_at asc`,
    )
      .bind(slug)
      .all<CommentRow>();

    return new Response(JSON.stringify({ ok: true, comments: results ?? [] }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        // Short enough that an approval shows up promptly, long enough to absorb a traffic spike
        // on a post without hitting D1 for every reader.
        'cache-control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('D1 comment read error:', error);
    return json(502, { ok: false, error: 'Unable to load comments at this time.' });
  }
};
