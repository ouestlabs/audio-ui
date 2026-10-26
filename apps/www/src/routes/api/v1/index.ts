import { createFileRoute } from "@tanstack/react-router";
import { rootResponse } from "@/lib/agents/rest-api";

export const Route = createFileRoute("/api/v1/")({
  server: { handlers: { GET: () => rootResponse() } },
});
