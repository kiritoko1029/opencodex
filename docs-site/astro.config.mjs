// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Project GitHub Pages site: https://lidge-jun.github.io/opencodex
// `site` + `base` make Starlight emit correct absolute URLs and asset paths under the repo subpath.
export default defineConfig({
  site: "https://lidge-jun.github.io",
  base: "/opencodex",
  integrations: [
    starlight({
      title: "opencodex",
      description:
        "Universal provider proxy for OpenAI Codex — use any LLM with Codex CLI, App, and SDK.",
      tagline: "Use any LLM with OpenAI Codex.",
      favicon: "/favicon.svg",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/lidge-jun/opencodex" },
      ],
      editLink: {
        baseUrl: "https://github.com/lidge-jun/opencodex/edit/main/docs-site/",
      },
      lastUpdated: true,
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quickstart", slug: "getting-started/quickstart" },
            { label: "How It Works", slug: "getting-started/how-it-works" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Providers", slug: "guides/providers" },
            { label: "Model Routing", slug: "guides/model-routing" },
            { label: "Codex Integration", slug: "guides/codex-integration" },
            { label: "Sidecars: Web Search & Vision", slug: "guides/sidecars" },
            { label: "Web Dashboard", slug: "guides/web-dashboard" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "CLI", slug: "reference/cli" },
            { label: "Configuration", slug: "reference/configuration" },
            { label: "Adapters", slug: "reference/adapters" },
            { label: "Architecture", slug: "reference/architecture" },
          ],
        },
        { label: "Contributing", slug: "contributing" },
      ],
    }),
  ],
});
