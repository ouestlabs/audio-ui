import { createMiddleware, createStart } from "@tanstack/react-start";
import { env, waitUntil } from "cloudflare:workers";
import { markdownOfPage } from "@/lib/llm-page";

/**
 * Runs before every request the Worker takes. Pages are prerendered files the
 * CDN serves without it, so it only sees what needs logic: the registry
 * (versioned addresses and their cache), PostHog's proxy, the markdown of the
 * docs, the former domain, and the routes that run code (/mcp, /llm, /init).
 */

const SITE = "https://www.audio-ui.dev";
const FORMER_HOST = /^(www\.)?audio-ui\.xyz$/;
const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as
  | string
  | undefined;
/** Changes on every deploy, so a registry address is a new cache key each time. */
const DEPLOYMENT_ID = import.meta.env.VITE_DEPLOYMENT_ID as string;

const BUILT_STYLES = new Set(
  ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"].map(
    (name) => `base-${name}`
  )
);
const DEFAULT_STYLE = "base-nova";
const REGISTRY_STYLES = /^\/r\/styles\/(.+)$/;
const REGISTRY_ITEM = /^\/r\/([^/]+)\.json$/;
const REGISTRY_STYLED_ITEM = /^\/r\/([^/]+)\/([^/]+)\.json$/;
const REGISTRY_FILE = /^\/r\/styles\/([^/]+)\/([^/]+)\.json$/;
const DOCS_MARKDOWN = /^\/docs\/(.+)\.md$/;
const DOCS_MDX = /^\/docs\/(.+)\.mdx$/;

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

/** What an agent reading the site's machine surfaces is told to PostHog, with no person attached. */
function agentEvent(pathname: string, method: string) {
  const registry = REGISTRY_FILE.exec(pathname);
  if (registry) {
    return {
      name: "registry_access",
      properties: { component: registry[2], style: registry[1] },
    };
  }
  if (pathname === "/mcp") {
    return { name: "mcp_request", properties: { method } };
  }
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    return { name: "llms_read", properties: { file: pathname } };
  }
  if (pathname.startsWith("/docs/") && pathname.endsWith(".md")) {
    return { name: "docs_markdown_read", properties: { path: pathname } };
  }
}

function trackAgentSurface(request: Request, url: URL) {
  const tracked = agentEvent(url.pathname, request.method);
  if (!(POSTHOG_KEY && tracked) || url.hostname === "localhost") {
    return;
  }
  waitUntil(
    fetch("https://us.i.posthog.com/capture/", {
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        distinct_id: "server",
        event: tracked.name,
        properties: {
          ...tracked.properties,
          $host: url.host,
          $process_person_profile: false,
          user_agent: request.headers.get("user-agent"),
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined)
  );
}

/** PostHog's ingestion, under our own address so blockers leave it be: assets from the assets host, the rest from the API host. */
function proxyPostHog(request: Request, url: URL) {
  const assets = url.pathname.startsWith("/ingest/static/");
  const host = assets ? "us-assets.i.posthog.com" : "us.i.posthog.com";
  const target = new URL(url);
  target.hostname = host;
  target.port = "";
  target.protocol = "https:";
  target.pathname = url.pathname.replace(/^\/ingest/, "");
  const headers = new Headers(request.headers);
  headers.set("host", host);
  headers.delete("cookie");
  return fetch(new Request(target, { ...request, headers }));
}

function redirect(location: string | URL, permanent: boolean) {
  return new Response(null, {
    headers: {
      "Cache-Control": permanent ? "public, max-age=31536000" : "no-store",
      Location: location.toString(),
    },
    status: permanent ? 308 : 307,
  });
}

/**
 * The registry's addresses. Whatever a project installed from, the item is at
 * `/r/styles/<style>/<name>.json?v=<deployment>`: the bare addresses redirect
 * there without being cached, so no client stays pinned to an older deploy,
 * and the versioned file is immutable for the life of the deploy.
 */
async function registry(request: Request, url: URL) {
  const version = url.searchParams.get("v");
  const style = REGISTRY_STYLED_ITEM.exec(url.pathname);
  const item = REGISTRY_ITEM.exec(url.pathname);
  const target = new URL(url);
  target.search = "";
  if (item) {
    // A style we do not build gets the default, so any shadcn project can install.
    target.pathname = `/r/styles/${DEFAULT_STYLE}/${item[1]}.json`;
  } else if (style && style[1] !== "styles") {
    target.pathname = `/r/styles/${
      BUILT_STYLES.has(style[1] ?? "") ? style[1] : DEFAULT_STYLE
    }/${style[2]}.json`;
  } else if (REGISTRY_STYLES.test(url.pathname) && version) {
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    response.headers.set("Cache-Control", IMMUTABLE);
    return response;
  } else if (!REGISTRY_STYLES.test(url.pathname)) {
    return;
  }
  target.searchParams.set("v", version ?? DEPLOYMENT_ID);
  return redirect(target, version !== null);
}

const edge = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);

  // The former domain keeps working, registry URLs included, so installed `components.json` files do not break.
  if (FORMER_HOST.test(url.hostname)) {
    return redirect(`${SITE}${url.pathname}${url.search}`, true);
  }
  if (url.pathname.startsWith("/ingest/")) {
    return proxyPostHog(request, url);
  }
  trackAgentSurface(request, url);

  if (DOCS_MDX.test(url.pathname)) {
    return redirect(
      `${url.origin}${url.pathname.replace(/\.mdx$/, ".md")}`,
      true
    );
  }
  // A docs page as markdown, at its own address with `.md`.
  const markdown = DOCS_MARKDOWN.exec(url.pathname);
  if (markdown) {
    return markdownOfPage(markdown[1]?.split("/") ?? []);
  }
  if (url.pathname.startsWith("/r/")) {
    const response = await registry(request, url);
    if (response) {
      return response;
    }
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [edge],
}));
