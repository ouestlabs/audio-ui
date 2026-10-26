import { createFileRoute } from "@tanstack/react-router";
import { getSiteUrl } from "@/lib/seo/seo";

/** Answer engines and agents are welcome: the docs are written to be read by them. */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

function robots() {
  const siteUrl = getSiteUrl();
  const crawlers = AI_CRAWLERS.map((agent) => `User-Agent: ${agent}`).join(
    "\n"
  );
  return `${crawlers}
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /llm/
Allow: /mcp
Allow: /api/

User-Agent: *
Allow: /
Disallow: /r/
Disallow: /*?*

Host: ${siteUrl}
Sitemap: ${siteUrl}/sitemap.xml
`;
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(robots(), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
