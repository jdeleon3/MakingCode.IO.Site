<?xml version="1.0" encoding="UTF-8"?>
<!--
  Makes /rss.xml readable when a person opens it in a browser instead of a feed reader.
  Feed readers ignore this entirely. Palette mirrors src/styles/global.css.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title><xsl:value-of select="/rss/channel/title" /> &#8212; RSS Feed</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="crossorigin" />
        <link rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&amp;family=IBM+Plex+Sans:wght@400;500&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap" />
        <style>
          :root {
            --surface: #0a0b0d;
            --surface-raised: #15171b;
            --ink: #ece7dd;
            --ink-muted: #8d8d86;
            --accent: #259ae8;
            --border: #26282d;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: var(--surface);
            color: var(--ink);
            font-family: 'IBM Plex Sans', system-ui, sans-serif;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
          }
          .wrap { max-width: 46rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
          .label {
            font-family: 'IBM Plex Mono', ui-monospace, monospace;
            font-size: 0.6875rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--accent);
          }
          h1 {
            font-family: 'Fraunces', Georgia, serif;
            font-size: 2.25rem;
            font-weight: 600;
            margin: 0.75rem 0 0.5rem;
          }
          .lede { color: var(--ink-muted); margin: 0 0 2rem; }
          .notice {
            border: 1px solid var(--border);
            background: var(--surface-raised);
            padding: 1.25rem 1.5rem;
            margin-bottom: 3rem;
          }
          .notice p { margin: 0 0 0.5rem; font-size: 0.9375rem; }
          .notice p:last-child { margin-bottom: 0; }
          code {
            font-family: 'IBM Plex Mono', ui-monospace, monospace;
            font-size: 0.8125rem;
            color: var(--accent);
            word-break: break-all;
          }
          a { color: var(--accent); text-decoration: none; }
          a:hover { text-decoration: underline; }
          .item { border-top: 1px solid var(--border); padding: 1.75rem 0; }
          .item h2 { font-family: 'Fraunces', Georgia, serif; font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
          .item p { margin: 0; color: var(--ink-muted); font-size: 0.9375rem; }
          .meta {
            font-family: 'IBM Plex Mono', ui-monospace, monospace;
            font-size: 0.6875rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--ink-muted);
            margin-bottom: 0.5rem;
          }
          footer { border-top: 1px solid var(--border); margin-top: 3rem; padding-top: 1.5rem; }
          footer p { font-size: 0.8125rem; color: var(--ink-muted); margin: 0; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <span class="label">RSS Feed</span>
          <h1><xsl:value-of select="/rss/channel/title" /></h1>
          <p class="lede"><xsl:value-of select="/rss/channel/description" /></p>

          <div class="notice">
            <p>This is an RSS feed. Paste this URL into a feed reader to get new posts as they publish:</p>
            <p><code><xsl:value-of select="/rss/channel/link" />rss.xml</code></p>
            <p>
              Or just
              <a>
                <xsl:attribute name="href"><xsl:value-of select="/rss/channel/link" /></xsl:attribute>
                read it on the site</a>.
            </p>
          </div>

          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <div class="meta"><xsl:value-of select="substring(pubDate, 1, 16)" /></div>
              <h2>
                <a>
                  <xsl:attribute name="href"><xsl:value-of select="link" /></xsl:attribute>
                  <xsl:value-of select="title" />
                </a>
              </h2>
              <p><xsl:value-of select="description" /></p>
            </div>
          </xsl:for-each>

          <footer>
            <p>
              <a>
                <xsl:attribute name="href"><xsl:value-of select="/rss/channel/link" /></xsl:attribute>
                <xsl:value-of select="/rss/channel/title" />
              </a>
              &#8212; written and shipped by one engineer.
            </p>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
