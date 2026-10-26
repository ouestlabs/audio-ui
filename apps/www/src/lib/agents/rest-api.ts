import { z } from "zod";
import { type ApiError, jsonError } from "@/lib/agents/errors";
import {
  COMPONENT_KINDS,
  listComponents,
  readComponentDocs,
  searchCatalogItems,
  searchComponentDocs,
} from "@/lib/agents/queries";
import { siteConfig } from "@/lib/config";

/**
 * The REST API at /api/v1: the components, their docs and the catalog as
 * JSON, the same answers as the MCP tools. Public, read-only, no key. The
 * version is in the path: a breaking change gets /api/v2, never a change to
 * v1 (the policy is on the docs page and in /openapi.json).
 */

export const API_VERSION = "v1";
export const API_BASE = `${siteConfig.url}/api/${API_VERSION}`;
export const API_DOCS = `${siteConfig.url}/docs/api`;
const OPENAPI = `${siteConfig.url}/openapi.json`;
const API_CATALOG = `${siteConfig.url}/.well-known/api-catalog`;
const DOC_HITS = 8;

/**
 * The quota of each client address: the API_RATE_LIMIT binding of
 * wrangler.jsonc enforces it, the RateLimit-Policy field announces it
 * (draft-ietf-httpapi-ratelimit-headers).
 */
export const RATE_LIMIT = Object.freeze({ quota: 120, window: 60 });
const RATE_LIMIT_POLICY = `"api";q=${RATE_LIMIT.quota};w=${RATE_LIMIT.window}`;

/** Every answer can be read from any origin, links its description (RFC 8631) and states its quota. */
const API_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  Link: `<${OPENAPI}>; rel="service-desc", <${API_DOCS}>; rel="service-doc"`,
  "RateLimit-Policy": RATE_LIMIT_POLICY,
};

function ok(body: unknown) {
  return Response.json(body, {
    headers: { ...API_HEADERS, "Cache-Control": "public, max-age=300" },
  });
}

export function apiError(body: ApiError) {
  return jsonError(body, API_HEADERS);
}

/** Query parameters, checked: the parsed values, or the 400 that names the first wrong one. */
function parseQuery<T extends z.ZodType>(schema: T, url: URL) {
  const result = schema.safeParse(Object.fromEntries(url.searchParams));
  if (result.success) {
    return { data: result.data as z.output<T> };
  }
  const [issue] = result.error.issues;
  return {
    error: apiError({
      error: "invalid_parameter",
      hint: `The parameters of every endpoint are at ${API_DOCS}.`,
      message: `Invalid "${issue?.path.join(".") ?? "query"}": ${issue?.message ?? "not accepted"}.`,
      status: 400,
    }),
  };
}

const componentsQuery = z.object({
  kind: z
    .enum(COMPONENT_KINDS, {
      error: `one of ${COMPONENT_KINDS.join(", ")}`,
    })
    .optional(),
});

const componentQuery = z.object({
  section: z.string().trim().min(1).optional(),
});

const searchQuery = z.object({
  limit: z.coerce
    .number({ error: "a whole number from 1 to 20" })
    .int({ error: "a whole number from 1 to 20" })
    .min(1, { error: "a whole number from 1 to 20" })
    .max(20, { error: "a whole number from 1 to 20" })
    .default(DOC_HITS),
  q: z
    .string({ error: "required, the words to search for" })
    .trim()
    .min(2, { error: "at least 2 characters" }),
});

const catalogQuery = z.object({
  offset: z.coerce
    .number({ error: "a whole number from 0" })
    .int({ error: "a whole number from 0" })
    .min(0, { error: "a whole number from 0" })
    .default(0),
  q: z.string().optional(),
});

function markdownUrl(docs: string) {
  return docs.replace(`${siteConfig.url}/docs`, `${siteConfig.url}/llm`);
}

/**
 * The API only reads: a request that is not a GET or a HEAD gets a 405
 * that says which are allowed, and a CORS preflight its answer.
 */
export function methodResponse(method: string) {
  if (method === "GET" || method === "HEAD") {
    return;
  }
  const allow = { ...API_HEADERS, Allow: "GET, HEAD, OPTIONS" };
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...allow,
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
      status: 204,
    });
  }
  return jsonError(
    {
      error: "method_not_allowed",
      hint: "The API only reads: send a GET.",
      message: `${method} is not allowed here: the API answers GET and HEAD.`,
      status: 405,
    },
    allow
  );
}

/**
 * Past the quota: a 429 whose RateLimit field says nothing is left in the
 * window, and whose Retry-After points at the window's end, not before.
 */
export function rateLimitedResponse() {
  const { quota, window } = RATE_LIMIT;
  return jsonError(
    {
      error: "rate_limited",
      hint: `Wait ${window} seconds, then go on below ${quota} requests a minute. Every answer's RateLimit-Policy header states the quota.`,
      message: `This address sent more than ${quota} requests in ${window} seconds.`,
      status: 429,
    },
    {
      ...API_HEADERS,
      RateLimit: `"api";r=0;t=${window}`,
      "Retry-After": String(window),
    }
  );
}

/** GET /api: the versions of the API. */
export function versionsResponse() {
  return ok({
    docs: API_DOCS,
    openapi: OPENAPI,
    versions: [{ status: "current", url: API_BASE, version: API_VERSION }],
  });
}

/** GET /api/v1: where every endpoint is, as URI templates (RFC 6570). */
export function rootResponse() {
  return ok({
    docs: API_DOCS,
    endpoints: {
      catalog: `${API_BASE}/catalog{?q,offset}`,
      component: `${API_BASE}/components/{name}{?section}`,
      components: `${API_BASE}/components{?kind}`,
      search: `${API_BASE}/search{?q,limit}`,
    },
    name: `${siteConfig.name} API`,
    openapi: OPENAPI,
    status: "current",
    version: API_VERSION,
  });
}

/** GET /api/v1/components: every component, or those of one kind. */
export function componentsResponse(url: URL) {
  const query = parseQuery(componentsQuery, url);
  if (query.error) {
    return query.error;
  }
  const components = listComponents(query.data.kind).map((component) => ({
    ...component,
    api_url: `${API_BASE}/components/${component.name}`,
    markdown_url: markdownUrl(component.docs),
  }));
  return ok({ components, total: components.length });
}

/** GET /api/v1/components/{name}: one component and its docs as markdown, whole or one section. */
export async function componentResponse(name: string, url: URL) {
  const query = parseQuery(componentQuery, url);
  if (query.error) {
    return query.error;
  }
  const { section } = query.data;
  const docs = await readComponentDocs(name, section);
  if (docs.problem === "unknown-component") {
    const guess =
      docs.suggestions.length > 0
        ? `Did you mean ${docs.suggestions.join(", ")}? `
        : "";
    return apiError({
      error: "not_found",
      hint: `${guess}List the components at ${API_BASE}/components, or search them at ${API_BASE}/search?q=.`,
      message: `There is no component named "${name}".`,
      status: 404,
    });
  }
  if (docs.problem === "unknown-section") {
    return apiError({
      error: "invalid_parameter",
      hint: `Sections of ${docs.slug}: ${docs.sections.join(", ")}.`,
      message: `Invalid "section": ${docs.slug} has no section "${section}".`,
      status: 400,
    });
  }
  return ok({
    ...docs.component,
    api_url: `${API_BASE}/components/${docs.component.name}`,
    markdown: docs.markdown,
    markdown_url: markdownUrl(docs.component.docs),
    section: section ?? null,
    sections: docs.sections,
  });
}

/** GET /api/v1/search: the parts of the component docs that answer a question, best first. */
export async function searchResponse(url: URL) {
  const query = parseQuery(searchQuery, url);
  if (query.error) {
    return query.error;
  }
  const { limit, q } = query.data;
  const hits = (await searchComponentDocs(q, limit)).map((hit) => ({
    ...hit,
    api_url: `${API_BASE}/components/${hit.component}?section=${encodeURIComponent(hit.section)}`,
  }));
  return ok({
    hits,
    query: q,
    total: hits.length,
    ...(hits.length === 0 && {
      hint: `Nothing matched. Try fewer or different words, or list the components at ${API_BASE}/components.`,
    }),
  });
}

/** GET /api/v1/catalog: the ready-made blocks and demos, a page at a time. */
export function catalogResponse(url: URL) {
  const query = parseQuery(catalogQuery, url);
  if (query.error) {
    return query.error;
  }
  return ok(searchCatalogItems(query.data.q, query.data.offset));
}

/**
 * /.well-known/api-catalog (RFC 9727): the site's APIs as a linkset
 * (RFC 9264). The catalog lists them first as its items (the RFC's
 * Appendix A.2), then each with its description, its docs and its status
 * (A.1). A HEAD request gets the Link header alone.
 */
export function apiCatalogResponse(method: "GET" | "HEAD") {
  const mcp = `${siteConfig.url}/mcp`;
  const linkset = [
    { anchor: API_CATALOG, item: [{ href: API_BASE }, { href: mcp }] },
    {
      anchor: API_BASE,
      "service-desc": [{ href: OPENAPI, type: "application/json" }],
      "service-doc": [{ href: API_DOCS, type: "text/html" }],
      status: [{ href: API_BASE, type: "application/json" }],
    },
    {
      anchor: mcp,
      "service-desc": [{ href: OPENAPI, type: "application/json" }],
      "service-doc": [
        { href: `${siteConfig.url}/docs/mcp`, type: "text/html" },
      ],
    },
  ];
  return new Response(method === "HEAD" ? null : JSON.stringify({ linkset }), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
      "Content-Type":
        'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
      Link: `<${API_CATALOG}>; rel="api-catalog"`,
    },
  });
}
