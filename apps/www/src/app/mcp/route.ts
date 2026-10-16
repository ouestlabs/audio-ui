import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { instrument } from "@posthog/mcp";
import { after } from "next/server";
import { PostHog } from "posthog-node";

import { createAudioUiMcpServer } from "@/lib/mcp-server";

export const dynamic = "force-dynamic";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthog = posthogKey
  ? new PostHog(posthogKey, { host: "https://us.i.posthog.com" })
  : null;

/** Stateless Streamable HTTP: a fresh server and transport per request, nothing to store between calls. */
async function handle(request: Request) {
  const server = createAudioUiMcpServer();
  if (posthog) {
    instrument(server, posthog);
    after(() => posthog.flush());
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as DELETE, handle as GET, handle as POST };
