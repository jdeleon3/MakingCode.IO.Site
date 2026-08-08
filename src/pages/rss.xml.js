import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { isPublished, byNewestFirst } from '../lib/publishing';
import { toSyndicatedHtml } from '../lib/feed';

export async function GET(context) {
  const posts = (await getCollection('blog', isPublished)).sort(byNewestFirst);

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    stylesheet: '/rss/styles.xsl',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
      // Full post body. `rendered.html` is populated by the content layer at build time; the
      // fallback keeps the feed valid (description-only) rather than emitting empty items if a
      // future loader change stops populating it.
      content: post.rendered?.html
        ? toSyndicatedHtml(post.rendered.html, context.site)
        : post.data.description,
    })),
    customData: [
      '<language>en-us</language>',
      `<copyright>© ${new Date().getFullYear()} MakingCode</copyright>`,
    ].join(''),
  });
}
