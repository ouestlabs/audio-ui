import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";

const { rewrite: rewriteLLM } = rewritePath("/docs/*path", "/llm/*path");

const REGISTRY_ITEM = /^\/r\/styles\/([^/]+)\/([^/]+)\.json$/;

function agentEvent(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const registry = REGISTRY_ITEM.exec(pathname);
  if (registry) {
    return {
      name: "registry_access",
      properties: { component: registry[2], style: registry[1] },
    };
  }
  if (pathname === "/mcp") {
    return { name: "mcp_request", properties: { method: request.method } };
  }
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    return { name: "llms_read", properties: { file: pathname } };
  }
  if (pathname.startsWith("/docs/") && pathname.endsWith(".md")) {
    return { name: "docs_markdown_read", properties: { path: pathname } };
  }
}

function trackAgentSurface(request: NextRequest, event: NextFetchEvent) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const tracked = agentEvent(request);
  if (!(key && tracked) || request.nextUrl.hostname === "localhost") {
    return;
  }
  event.waitUntil(
    fetch("https://us.i.posthog.com/capture/", {
      body: JSON.stringify({
        api_key: key,
        distinct_id: "server",
        event: tracked.name,
        properties: {
          ...tracked.properties,
          $host: request.nextUrl.host,
          $process_person_profile: false,
          user_agent: request.headers.get("user-agent"),
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined)
  );
}

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  trackAgentSurface(request, event);

  if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}
