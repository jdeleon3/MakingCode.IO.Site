/**
 * Cloudflare Turnstile, loaded once from `BaseHead.astro`.
 *
 * `reset` takes a container selector or element, not just an opaque widget id. That distinction
 * matters now that blog posts render two widgets (newsletter + comments) — calling `reset()` with
 * no argument targets whichever widget rendered last, which is a coin flip.
 */
declare global {
  interface Window {
    turnstile?: {
      reset: (container?: string | HTMLElement) => void;
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    };
  }
}

export {};
