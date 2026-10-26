import { negotiate } from "@/lib/agents/negotiate";
import { siteConfig } from "@/lib/config";

export const HTML = "text/html";
export const MARKDOWN = "text/markdown";
export const JSON_TYPE = "application/json";

/** The addresses of the JSON APIs, the REST API and the registry: they answer JSON whatever the request accepts. */
const JSON_APIS = /^\/(api|r)(\/|$)/;

/**
 * The body of a JSON error. `error` and `message` are the fields the shadcn
 * CLI prints (`[not_found] …`) when the registry answers with one.
 */
export interface ApiError {
  error:
    | "invalid_parameter"
    | "method_not_allowed"
    | "not_acceptable"
    | "not_found"
    | "rate_limited";
  hint: string;
  message: string;
  status: number;
}

/** Where an agent that took a wrong turn starts again. */
const START_HERE = `Start from ${siteConfig.url}/api/v1 (the REST API), ${siteConfig.url}/openapi.json (its description) or ${siteConfig.url}/llms.txt (every docs page, as markdown).`;

/** The answer depends on the request's `Accept`: a cache keeps one per value. */
export function withVary(response: Response) {
  const varied = new Response(response.body, response);
  varied.headers.append("Vary", "Accept");
  return varied;
}

export function jsonError(body: ApiError, headers?: Record<string, string>) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store", ...headers },
    status: body.status,
  });
}

/** An address with no page, as markdown: what went wrong and the way back in. */
export function markdownNotFound(pathname: string) {
  const markdown = `# Not found

There is no page at \`${pathname}\` on ${siteConfig.name}. It may have moved, or the address may be mistyped.

- [llms.txt](${siteConfig.url}/llms.txt): every docs page, each as markdown
- [Docs](${siteConfig.url}/llm): the introduction, as markdown
- [Sitemap](${siteConfig.url}/sitemap.xml): every page of the site
- [REST API](${siteConfig.url}/api/v1): the components, their docs and the catalog as JSON
- [OpenAPI](${siteConfig.url}/openapi.json): the REST API, the registry and the docs, described
`;
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
    },
    status: 404,
  });
}

export function jsonNotFound(pathname: string) {
  return jsonError(
    {
      error: "not_found",
      hint: START_HERE,
      message: `There is no page or API endpoint at ${pathname}.`,
      status: 404,
    },
    { Vary: "Accept" }
  );
}

/** A registry address the build has no file for. */
export function registryNotFound(style: string, name: string) {
  return jsonError({
    error: "not_found",
    hint: `List the items at ${siteConfig.url}/r/registry.json, or search them with the search_catalog tool of ${siteConfig.url}/mcp. The styles are listed at ${siteConfig.url}/r/styles/index.json.`,
    message: `The registry has no item "${name}" in the style "${style}".`,
    status: 404,
  });
}

/** None of the forms an address has is one the request takes (RFC 9110, 15.5.7): the forms it has, to ask again. */
export function notAcceptable(accept: string | null, offers: string[]) {
  const body = `This resource is available in:
${offers.map((offer) => `- ${offer}`).join("\n")}

You requested: ${accept}
`;
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      Vary: "Accept",
      // The body repeats the request's Accept: never read as anything but text.
      "X-Content-Type-Options": "nosniff",
    },
    status: 406,
  });
}

/**
 * What an address with nothing at it answers. The router's 404 page stays
 * for a browser; an agent that asks for markdown or JSON gets it, and the
 * registry, a JSON API, always answers JSON. A request that takes none of
 * the three keeps the router's answer.
 */
export function missingResponse(request: Request, routerResponse: Response) {
  const { pathname } = new URL(request.url);
  const type = JSON_APIS.test(pathname)
    ? JSON_TYPE
    : negotiate(request.headers.get("accept"), [HTML, MARKDOWN, JSON_TYPE]);
  if (type === MARKDOWN) {
    return markdownNotFound(pathname);
  }
  if (type === JSON_TYPE) {
    return jsonNotFound(pathname);
  }
  return type === HTML ? withVary(routerResponse) : routerResponse;
}
