import { createFileRoute } from "@tanstack/react-router";
import { searchResponse } from "@/lib/agents/rest-api";

export const Route = createFileRoute("/api/v1/search")({
  server: {
    handlers: { GET: ({ request }) => searchResponse(new URL(request.url)) },
  },
});
