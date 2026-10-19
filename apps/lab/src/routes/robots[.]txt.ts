import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "../lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `User-Agent: *
Allow: /

Host: ${SITE.url}
Sitemap: ${SITE.url}/sitemap.xml
`,
          { headers: { "Content-Type": "text/plain; charset=utf-8" } }
        ),
    },
  },
});
