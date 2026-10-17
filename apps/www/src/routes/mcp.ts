import { waitUntil } from "cloudflare:workers";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { instrument } from "@posthog/mcp";
import { createFileRoute } from "@tanstack/react-router";
import { PostHog } from "posthog-node";
import { createAudioUiMcpServer } from "@/lib/mcp-server";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthog = posthogKey
  ? new PostHog(posthogKey, { host: "https://us.i.posthog.com" })
  : null;

/** Stateless Streamable HTTP: a fresh server and transport per request, nothing to store between calls. */
async function handle({ request }: { request: Request }) {
  const server = createAudioUiMcpServer();
  if (posthog) {
    instrument(server, posthog);
    waitUntil(posthog.flush());
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const Route = createFileRoute("/mcp")({
  server: { handlers: { DELETE: handle, GET: handle, POST: handle } },
});
