import { createFileRoute } from "@tanstack/react-router";
import { catalogResponse } from "@/lib/agents/rest-api";

export const Route = createFileRoute("/api/v1/catalog")({
  server: {
    handlers: { GET: ({ request }) => catalogResponse(new URL(request.url)) },
  },
});
