import { createFileRoute } from "@tanstack/react-router";
import { getLlmsTxt } from "@/lib/llms";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(getLlmsTxt(), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
