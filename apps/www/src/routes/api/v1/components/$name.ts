import { createFileRoute } from "@tanstack/react-router";
import { componentResponse } from "@/lib/agents/rest-api";

export const Route = createFileRoute("/api/v1/components/$name")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        componentResponse(params.name, new URL(request.url)),
    },
  },
});
