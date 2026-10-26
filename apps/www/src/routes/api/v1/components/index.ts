import { createFileRoute } from "@tanstack/react-router";
import { componentsResponse } from "@/lib/agents/rest-api";

export const Route = createFileRoute("/api/v1/components/")({
  server: {
    handlers: {
      GET: ({ request }) => componentsResponse(new URL(request.url)),
    },
  },
});
