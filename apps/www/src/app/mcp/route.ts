import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createAudioUiMcpServer } from "@/lib/mcp-server";

export const dynamic = "force-dynamic";

/** Stateless Streamable HTTP: a fresh server and transport per request, nothing to store between calls. */
async function handle(request: Request) {
  const server = createAudioUiMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as DELETE, handle as GET, handle as POST };
