-- Blog comments, migrated off hosted Supabase (which pauses free-tier projects for inactivity).
--
-- The Postgres original relied on RLS to let a browser talk to the database directly with the anon
-- key. D1 has no public client at all: every read and write goes through a Pages Function, so the
-- Function *is* the access control and there is no RLS equivalent to port. The length checks and the
-- status enum carry over as SQLite CHECK constraints so the database still refuses malformed rows
-- even if validation in the Function is ever bypassed.
--
-- Apply with: npx wrangler d1 execute makingcode-io-comments --remote --file db/migrations/0001_comments.sql

create table if not exists comments (
  id text primary key,
  post_slug text not null,
  author_name text not null check (length(author_name) <= 100),
  -- Never displayed publicly. Stored for spam triage and replies only.
  author_email text not null check (length(author_email) <= 200),
  body text not null check (length(body) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Salted SHA-256 of CF-Connecting-IP — for abuse review, never the raw IP.
  ip_hash text,
  created_at text not null,
  moderated_at text
);

-- Serves the public read path: approved comments for one post, oldest first.
create index if not exists comments_post_slug_status_idx on comments (post_slug, status, created_at);

-- Serves the admin queue: everything pending, newest first.
create index if not exists comments_status_created_idx on comments (status, created_at desc);
