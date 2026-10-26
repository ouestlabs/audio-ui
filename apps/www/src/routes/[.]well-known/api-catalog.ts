import { createFileRoute } from "@tanstack/react-router";
import { apiCatalogResponse } from "@/lib/agents/rest-api";

export const Route = createFileRoute("/.well-known/api-catalog")({
  server: {
    handlers: {
      GET: () => apiCatalogResponse("GET"),
      HEAD: () => apiCatalogResponse("HEAD"),
    },
  },
});
