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
import { registryEvent } from "@/lib/agents/registry-event";
import { methodResponse, rateLimitedResponse } from "@/lib/agents/rest-api";
import { BUILT_STYLES, DEFAULT_STYLE } from "@/lib/registry/core/styles";
import { addressOfLayoutPath } from "@/lib/seo/layout-paths";

/**
 * Runs before every request the Worker takes. Pages are prerendered files the
 * CDN serves without it, so it only sees what needs logic: the home (HTML or
 * markdown, by Accept), the registry (versioned addresses and their cache),
 * PostHog's proxy, the markdown of the docs, llms.txt (to count its reads), the
 * routes that run code (/mcp, /llm, /init), and the addresses that have no page.
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
const LLMS_FILE = /^\/llms(-full)?\.txt$/;

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

/** Docs pages merged into another: each old address and the page that holds it now. */
const MOVED_PAGES = new Map([
  [
    "/docs/components/base/arrangement-editor",
    "/docs/components/base/arrangement",
  ],
  ["/docs/components/base/timeline", "/docs/components/base/arrangement"],
  // The docs by the stack: pages that moved into the Core, Elements and React sections.
  ["/docs/primitives", "/docs/react"],
  ["/docs/headless-styling", "/docs/react/headless-styling"],
  ["/docs/custom-elements", "/docs/elements"],
  ["/docs/engine/controllers", "/docs/core/controllers"],
  ["/docs/primitives.md", "/docs/react.md"],
  ["/docs/headless-styling.md", "/docs/react/headless-styling.md"],
  ["/docs/custom-elements.md", "/docs/elements.md"],
  ["/docs/engine/controllers.md", "/docs/core/controllers.md"],
  // The guides left /docs/engine for the engine package's pages; the two whose
  // names a module took, analysis and playback, now open that module's page.
  ["/docs/engine/output", "/docs/guides/output"],
  ["/docs/engine/clock-and-time", "/docs/guides/clock-and-time"],
  ["/docs/engine/synthesis", "/docs/guides/synthesis"],
  ["/docs/engine/demo-sounds", "/docs/guides/demo-sounds"],
  ["/docs/engine/input", "/docs/guides/input"],
  ["/docs/engine/output.md", "/docs/guides/output.md"],
  ["/docs/engine/clock-and-time.md", "/docs/guides/clock-and-time.md"],
  ["/docs/engine/synthesis.md", "/docs/guides/synthesis.md"],
  ["/docs/engine/demo-sounds.md", "/docs/guides/demo-sounds.md"],
  ["/docs/engine/input.md", "/docs/guides/input.md"],
  // The audio modules left @audio-ui/core for @audio-ui/engine.
  ["/docs/core/device", "/docs/engine/device"],
  ["/docs/core/time", "/docs/engine/time"],
  ["/docs/core/analysis", "/docs/engine/analysis"],
  ["/docs/core/pitch", "/docs/engine/pitch"],
  ["/docs/core/midi", "/docs/engine/midi"],
  ["/docs/core/playback", "/docs/engine/playback"],
  ["/docs/core/device.md", "/docs/engine/device.md"],
  ["/docs/core/time.md", "/docs/engine/time.md"],
  ["/docs/core/analysis.md", "/docs/engine/analysis.md"],
  ["/docs/core/pitch.md", "/docs/engine/pitch.md"],
  ["/docs/core/midi.md", "/docs/engine/midi.md"],
  ["/docs/core/playback.md", "/docs/engine/playback.md"],
]);

/** What a read of the site's machine surfaces is told to PostHog. A registry file has its own: it counts once it is served (registryFile). */
function agentEvent(pathname: string, method: string) {
  if (pathname === "/mcp") {
    return { name: "mcp_request", properties: { method } };
  }
  if (LLMS_FILE.test(pathname)) {
    return { name: "llms_read", properties: { file: pathname } };
  }
  if (pathname === "/docs.md" || DOCS_MARKDOWN.test(pathname)) {
    return { name: "docs_markdown_read", properties: { path: pathname } };
  }
}

/** Tells PostHog, with no person attached. `$raw_user_agent` is what it reads to name a bot or an AI agent. */
function trackAgentSurface(
  request: Request,
  url: URL,
  tracked?: { name: string; properties: Record<string, unknown> }
) {
  if (!(POSTHOG_KEY && tracked) || url.hostname === "localhost") {
    return;
  }
  const userAgent = request.headers.get("user-agent");
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
          $raw_user_agent: userAgent,
          user_agent: userAgent,
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
  const file = REGISTRY_FILE.exec(url.pathname);
  if (asset.status === 404) {
    return file
      ? registryNotFound(file[1] ?? "", file[2] ?? "")
      : jsonNotFound(url.pathname);
  }
  if (file) {
    trackAgentSurface(
      request,
      url,
      registryEvent(request.headers, file[1] ?? "", file[2] ?? "")
    );
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
 * A file of the build that the Worker stands in front of: the registry's, or an
 * llms file, which it runs first for (wrangler.jsonc) only to count the read.
 * Nothing means the router answers: in development, and while the build
 * prerenders it.
 */
async function buildFile(request: Request, url: URL) {
  if (url.pathname.startsWith("/r/")) {
    return registry(request, url);
  }
  if (LLMS_FILE.test(url.pathname)) {
    const file = await env.ASSETS.fetch(request);
    return file.ok ? file : undefined;
  }
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
  trackAgentSurface(request, url, agentEvent(url.pathname, request.method));

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
  const file = await buildFile(request, url);
  if (file) {
    return file;
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
