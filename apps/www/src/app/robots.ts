import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo";

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

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    host: siteUrl,
    rules: [
      {
        allow: ["/", "/llms.txt", "/llms-full.txt", "/llm/", "/mcp"],
        disallow: ["/api/"],
        userAgent: AI_CRAWLERS,
      },
      {
        allow: "/",
        disallow: ["/api/", "/r/", "/*?*"],
        userAgent: "*",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
