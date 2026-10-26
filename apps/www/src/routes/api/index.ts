import { createFileRoute } from "@tanstack/react-router";
import { versionsResponse } from "@/lib/agents/rest-api";

export const Route = createFileRoute("/api/")({
  server: { handlers: { GET: () => versionsResponse() } },
});
