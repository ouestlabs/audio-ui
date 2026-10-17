import { createFileRoute } from "@tanstack/react-router";
import { getRSS } from "@/lib/seo/rss";

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(getRSS(), {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
        }),
    },
  },
});
