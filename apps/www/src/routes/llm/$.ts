import { createFileRoute } from "@tanstack/react-router";
import { markdownOfPage } from "@/lib/llm-page";

export const Route = createFileRoute("/llm/$")({
  server: {
    handlers: {
      GET: ({ params }) => markdownOfPage(params._splat?.split("/") ?? []),
    },
  },
});
