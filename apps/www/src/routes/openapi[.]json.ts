import { createFileRoute } from "@tanstack/react-router";
import { getOpenApiDocument } from "@/lib/agents/openapi";

export const Route = createFileRoute("/openapi.json")({
  server: {
    handlers: {
      GET: () => Response.json(getOpenApiDocument()),
    },
  },
});
