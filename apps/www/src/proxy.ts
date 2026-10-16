import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";

const { rewrite: rewriteLLM } = rewritePath("/docs/*path", "/llm/*path");

const REGISTRY_ITEM = /^\/r\/styles\/([^/]+)\/([^/]+)\.json$/;

function trackRegistryAccess(request: NextRequest, event: NextFetchEvent) {
  const match = REGISTRY_ITEM.exec(request.nextUrl.pathname);
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!(match && key)) {
    return;
  }
  event.waitUntil(
    fetch("https://us.i.posthog.com/capture/", {
      body: JSON.stringify({
        api_key: key,
        distinct_id: "registry",
        event: "registry_access",
        properties: {
          $host: request.nextUrl.host,
          $process_person_profile: false,
          component: match[2],
          style: match[1],
          user_agent: request.headers.get("user-agent"),
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined)
  );
}

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  trackRegistryAccess(request, event);

  if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}
