---
name: asset-generation
description: Generates, places, and optimizes hero images and inline visual assets for MakingCode.io blog posts and project writeups using Antigravity's generate_image tool. Use when the user requests an image, hero asset, architectural diagram, or visual preview for a post or project, e.g. "generate a hero image for X", "create a visual for post Y".
---

# Asset Generation

Generates high-quality visual assets tailored for MakingCode.io, keeping images aligned with the site's dark mode design system, technical depth, and brand positioning (`brand-brief.md`).

## Design & Style Principles

1. **Aesthetic Calibration**:
   - Dark theme, modern engineering aesthetic (deep slate/charcoal backgrounds `#0f172a`, subtle indigo/cyan accents `#38bdf8`, clean technical typography or schematics).
   - Avoid generic AI stock photo tropes: **No glowing blue brains**, **no floating holographic spheres**, **no generic corporate handshakes**, **no sci-fi neon portals**.
   - Prefer minimal architectural diagrams, system blueprints, pipeline flows, circuit/code visualizations, or dark vector-style tech artwork.

2. **Aspect Ratios**:
   - **Hero Images**: `16:9` (preferred) or `3:2`.
   - **Inline Diagrams / Figures**: `16:9` or `4:3` or `1:1` depending on layout fit.

3. **Storage & Path Conventions**:
   - **Hero Images**: Store in `src/assets/blog/<slug>.<ext>` or `src/assets/projects/<slug>.<ext>`.
     - Frontmatter reference (Astro `astro:assets` relative path):
       ```yaml
       heroImage: '../../assets/blog/securing-the-webhook-queue.jpg'
       ```
   - **Inline Body Images**: Store in `public/images/blog/<slug>/<name>.<ext>` or `public/images/projects/<slug>/<name>.<ext>`.
     - Markdown inline reference:
       ```markdown
       ![Architecture diagram of the webhook worker pipeline](/images/blog/securing-the-webhook-queue/pipeline-architecture.png)
       ```

## Steps

1. **Determine Target & Location**:
   - Identify post slug and whether it's a hero image or inline asset.
   - Verify directory exists or create parent directories if needed.

2. **Craft the Prompt for `generate_image`**:
   - Build a prompt specifying the visual theme: dark background, technical schematic/architecture style, precise colors, no text overlay unless explicitly requested, no cheesy AI tropes.
   - Example prompt:
     > "Dark-themed modern software architecture diagram visualizing an event-driven webhook queue with worker pools and retry dead-letter queues. Sleek cyan and slate colors, clean geometric lines, dark slate background #0b0f19, high contrast, professional technical illustration style, 16:9 aspect ratio."

3. **Invoke `generate_image`**:
   - Pass `Prompt`, `ImageName`, and `AspectRatio`.

4. **Place & Reference Asset**:
   - Move or copy the generated artifact file to the target path:
     - Hero image: `src/assets/{blog,projects}/<slug>.<ext>`
     - Inline image: `public/images/{blog,projects}/<slug>/<name>.<ext>`
   - Update frontmatter or markdown body with the proper path.

5. **Verify**:
   - Check file existence on disk.
   - Run `npm run check` or `npm run build` to confirm Astro asset imports resolve cleanly.
