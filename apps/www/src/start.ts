import { env, waitUntil } from "cloudflare:workers";
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import {
  HTML,
  jsonNotFound,
  MARKDOWN,
  missingResponse,
  notAcceptable,
  registryNotFound,
  withVary,
} from "@/lib/agents/errors";
import { markdownOfPage } from "@/lib/agents/llm-page";
import { getLlmsTxt } from "@/lib/agents/llms";
import { negotiate } from "@/lib/agents/negotiate";
import { methodResponse, rateLimitedResponse } from "@/lib/agents/rest-api";
import { BUILT_STYLES, DEFAULT_STYLE } from "@/lib/registry/core/styles";
import { addressOfLayoutPath } from "@/lib/seo/layout-paths";

/**
 * Runs before every request the Worker takes. Pages are prerendered files the
 * CDN serves without it, so it only sees what needs logic: the home (HTML or
 * markdown, by Accept), the registry (versioned addresses and their cache),
 * PostHog's proxy, the markdown of the docs, the routes that run code (/mcp,
 * /llm, /init), and the addresses that have no page.
 */

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as
  | string
  | undefined;
/** Changes on every deploy, so a registry address is a new cache key each time. */
const DEPLOYMENT_ID = import.meta.env.VITE_DEPLOYMENT_ID as string;

const HOME_TYPES = [HTML, MARKDOWN];
const API_PATH = /^\/api(\/|$)/;
const REGISTRY_STYLES = /^\/r\/styles\/(.+)$/;
const REGISTRY_ITEM = /^\/r\/([^/]+)\.json$/;
const REGISTRY_STYLED_ITEM = /^\/r\/([^/]+)\/([^/]+)\.json$/;
const MDX_SUFFIX = /\.mdx$/;
const INGEST_PREFIX = /^\/ingest/;
const REGISTRY_FILE = /^\/r\/styles\/([^/]+)\/([^/]+)\.json$/;
const DOCS_MARKDOWN = /^\/docs\/(.+)\.md$/;
const DOCS_MDX = /^\/docs\/(.+)\.mdx$/;

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

/** Docs pages merged into another: each old address and the page that holds it now. */
const MOVED_PAGES = new Map([
  [
    "/docs/components/base/arrangement-editor",
    "/docs/components/base/arrangement",
  ],
  ["/docs/components/base/timeline", "/docs/components/base/arrangement"],
]);

/** What an agent reading the site's machine surfaces is told to PostHog, with no person attached. */
function agentEvent(pathname: string, method: string) {
  const item = REGISTRY_FILE.exec(pathname);
  if (item) {
    return {
      name: "registry_access",
      properties: { component: item[2], style: item[1] },
    };
  }
  if (pathname === "/mcp") {
    return { name: "mcp_request", properties: { method } };
  }
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    return { name: "llms_read", properties: { file: pathname } };
  }
  if (pathname === "/docs.md" || DOCS_MARKDOWN.test(pathname)) {
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
  target.pathname = url.pathname.replace(INGEST_PREFIX, "");
  const headers = new Headers(request.headers);
  headers.set("host", host);
  headers.delete("cookie");
  return fetch(target, {
    body: request.body,
    headers,
    method: request.method,
  });
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

/** A registry file of this deploy, cached for good. One the build did not make is a JSON 404, which the shadcn CLI prints. */
async function registryFile(request: Request, url: URL) {
  const asset = await env.ASSETS.fetch(request);
  if (asset.status === 404) {
    const file = REGISTRY_FILE.exec(url.pathname);
    return file
      ? registryNotFound(file[1] ?? "", file[2] ?? "")
      : jsonNotFound(url.pathname);
  }
  const response = new Response(asset.body, asset);
  response.headers.set("Cache-Control", IMMUTABLE);
  return response;
}

/**
 * The registry's addresses. Whatever a project installed from, the item is at
 * `/r/styles/<style>/<name>.json?v=<deployment>`: the bare addresses redirect
 * there without being cached, so no client stays pinned to an older deploy,
 * and the versioned file is immutable for the life of the deploy.
 */
function registry(request: Request, url: URL) {
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
      BUILT_STYLES.includes(style[1] ?? "") ? style[1] : DEFAULT_STYLE
    }/${style[2]}.json`;
  } else if (REGISTRY_STYLES.test(url.pathname) && version) {
    return registryFile(request, url);
  } else if (!REGISTRY_STYLES.test(url.pathname)) {
    return;
  }
  target.searchParams.set("v", version ?? DEPLOYMENT_ID);
  return redirect(target, version !== null);
}

/**
 * The home in the form the request asks for: the prerendered page, or the
 * map of the docs that llms.txt is, as markdown. The Worker runs first for
 * `/` (wrangler.jsonc) to choose, so the answer varies on Accept. Nothing
 * means the router renders the page: in development, and while the build
 * prerenders it, there is no file yet.
 */
async function home(request: Request) {
  const accept = request.headers.get("accept");
  const type = negotiate(accept, HOME_TYPES);
  if (type === MARKDOWN) {
    return new Response(getLlmsTxt(), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        Vary: "Accept",
      },
    });
  }
  if (type !== HTML) {
    return notAcceptable(accept, HOME_TYPES);
  }
  if (import.meta.env.DEV) {
    return;
  }
  const page = await env.ASSETS.fetch(request);
  return page.ok || page.status === 304 ? withVary(page) : undefined;
}

/**
 * Whether a client went past the REST API's quota (RATE_LIMIT). It is counted
 * per address, in each Cloudflare location and approximately: the API has no
 * keys, so the address is the only name a client has.
 */
async function overQuota(request: Request) {
  const { success } = await env.API_RATE_LIMIT.limit({
    key: request.headers.get("cf-connecting-ip") ?? "unknown",
  });
  return !success;
}

/**
 * Every page that exists is a file the CDN serves first, so a page the router
 * answers has none: its 404 page, or its 406 when HTML is not accepted. A
 * route's own errors (the API's JSON, the docs' markdown, the MCP transport's
 * 406) are its answer, and stay.
 */
function isRouterMiss(response: Response, pathname: string) {
  if (response.status === 404) {
    return response.headers.get("content-type")?.startsWith(HTML) ?? false;
  }
  return response.status === 406 && pathname !== "/mcp";
}

const edge = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/ingest/")) {
    return proxyPostHog(request, url);
  }
  // A layout's route id, found by a crawler in the router's state, or the old
  // address of a merged page: the page it stands for.
  const address =
    addressOfLayoutPath(url.pathname) ?? MOVED_PAGES.get(url.pathname);
  if (address) {
    return redirect(`${url.origin}${address}${url.search}`, true);
  }
  trackAgentSurface(request, url);

  if (DOCS_MDX.test(url.pathname)) {
    return redirect(
      `${url.origin}${url.pathname.replace(MDX_SUFFIX, ".md")}`,
      true
    );
  }
  // A docs page as markdown, at its own address with `.md`; the introduction is `/docs.md`.
  if (url.pathname === "/docs.md") {
    return markdownOfPage([]);
  }
  const markdown = DOCS_MARKDOWN.exec(url.pathname);
  if (markdown) {
    return markdownOfPage(markdown[1]?.split("/") ?? []);
  }
  if (url.pathname === "/") {
    return (await home(request)) ?? withVary((await next()).response);
  }
  if (url.pathname.startsWith("/r/")) {
    const response = await registry(request, url);
    if (response) {
      return response;
    }
  }
  if (API_PATH.test(url.pathname)) {
    const response =
      methodResponse(request.method) ??
      ((await overQuota(request)) ? rateLimitedResponse() : undefined);
    if (response) {
      return response;
    }
  }
  const result = await next();
  return isRouterMiss(result.response, url.pathname)
    ? missingResponse(request, result.response)
    : result;
});

/** Server functions are same-origin calls: a request from another site is refused. */
const csrf = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, edge],
}));
