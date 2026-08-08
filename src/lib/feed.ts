import sanitizeHtml from 'sanitize-html';

/**
 * Rewrites root-relative URLs in rendered post HTML to absolute ones.
 *
 * Astro emits hashed asset paths like `/_astro/hero.abc123.webp`, and inline `<img>` tags in post
 * bodies point at `/images/...`. Both are dead links once the HTML leaves the site — a feed reader
 * or an email client has no origin to resolve them against.
 */
export function toAbsoluteUrls(html: string, site: URL | string): string {
  const origin = new URL(site).origin;
  return html.replace(
    /(\s(?:src|href|poster)=)(["'])\/(?!\/)/g,
    (_match, attr: string, quote: string) => `${attr}${quote}${origin}/`,
  );
}

/**
 * Allowlist for syndicated HTML. Extends the sanitize-html defaults with the tags Astro's markdown
 * pipeline actually emits — images, figures, and Shiki's `<pre><code>` blocks (which carry inline
 * `style` attributes for token colors, so `style` has to survive on those).
 */
const FEED_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'figure',
    'figcaption',
    'h1',
    'h2',
    'del',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    a: ['href', 'name', 'target', 'rel'],
    code: ['class', 'style'],
    span: ['class', 'style'],
    pre: ['class', 'style', 'tabindex'],
  },
  // Shiki colors tokens with inline styles; without this every code block renders unstyled.
  allowedSchemes: ['http', 'https', 'mailto'],
};

/** Rendered post HTML, made safe and portable for RSS readers and email clients. */
export function toSyndicatedHtml(html: string, site: URL | string): string {
  return sanitizeHtml(toAbsoluteUrls(html, site), FEED_SANITIZE_OPTIONS);
}
