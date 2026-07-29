import type { CollectionEntry } from 'astro:content';

/**
 * An entry is published when it isn't marked `draft` and its `pubDate` isn't in the future.
 *
 * Caveat this site is built on: this filter only runs at build time. On a statically-generated
 * site rebuilt on push (see CLAUDE.md), a future-dated entry doesn't appear the instant its date
 * arrives — it appears at the next production build *after* that date. There is no cron rebuild
 * wired up. Don't describe scheduled publishing as fully automatic without that caveat.
 */
export function isPublished(entry: CollectionEntry<'blog'> | CollectionEntry<'projects'>): boolean {
  return !entry.data.draft && entry.data.pubDate.valueOf() <= Date.now();
}

export function byNewestFirst(
  a: CollectionEntry<'blog'> | CollectionEntry<'projects'>,
  b: CollectionEntry<'blog'> | CollectionEntry<'projects'>,
): number {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}
