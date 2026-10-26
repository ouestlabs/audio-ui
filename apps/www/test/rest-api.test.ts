import { describe, expect, test } from "bun:test";
import "./fixtures/agent-docs";
import { siteConfig } from "@/lib/config";

const {
  apiCatalogResponse,
  catalogResponse,
  componentResponse,
  componentsResponse,
  methodResponse,
  rootResponse,
  searchResponse,
  versionsResponse,
} = await import("@/lib/agents/rest-api");

const API = `${siteConfig.url}/api/v1`;
const url = (path: string) => new URL(`${API}${path}`);

async function body(response: Response | Promise<Response>) {
  return (await (await response).json()) as Record<string, unknown>;
}

describe("the answers", () => {
  test("carry CORS, a short cache and the link to their description", () => {
    const response = rootResponse();
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("link")).toBe(
      `<${siteConfig.url}/openapi.json>; rel="service-desc", <${siteConfig.url}/docs/api>; rel="service-doc"`
    );
  });

  test("GET /api lists the versions, v1 current", async () => {
    expect((await body(versionsResponse())).versions).toEqual([
      { status: "current", url: API, version: "v1" },
    ]);
  });

  test("GET /api/v1 says where every endpoint is", async () => {
    const root = await body(rootResponse());
    expect(root.version).toBe("v1");
    expect(root.endpoints).toEqual({
      catalog: `${API}/catalog{?q,offset}`,
      component: `${API}/components/{name}{?section}`,
      components: `${API}/components{?kind}`,
      search: `${API}/search{?q,limit}`,
    });
  });
});

describe("GET /api/v1/components", () => {
  test("lists every component with its links and its install command", async () => {
    const { components, total } = await body(
      componentsResponse(url("/components"))
    );
    expect(total).toBe(2);
    expect((components as Record<string, unknown>[])[0]).toEqual({
      api_url: `${API}/components/knob`,
      description: "A rotary control.",
      docs: `${siteConfig.url}/docs/components/base/knob`,
      install: "npx shadcn@latest add @audio-ui/knob",
      kind: "elements",
      markdown_url: `${siteConfig.url}/llm/components/base/knob`,
      name: "knob",
      title: "Knob",
    });
  });

  test("keeps one kind", async () => {
    const { components } = await body(
      componentsResponse(url("/components?kind=devices"))
    );
    expect(
      (components as { name: string }[]).map((component) => component.name)
    ).toEqual(["compressor"]);
  });

  test("an unknown kind is a 400 that names the kinds", async () => {
    const response = componentsResponse(url("/components?kind=pedals"));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await body(response)).toEqual({
      error: "invalid_parameter",
      hint: `The parameters of every endpoint are at ${siteConfig.url}/docs/api.`,
      message: 'Invalid "kind": one of elements, workstation, devices.',
      status: 400,
    });
  });
});

describe("GET /api/v1/components/{name}", () => {
  test("answers the component and its docs, with the sections to ask for", async () => {
    const knob = await body(componentResponse("knob", url("/components/knob")));
    expect(knob.name).toBe("knob");
    expect(knob.section).toBeNull();
    expect(knob.sections).toEqual(
      expect.arrayContaining(["installation", "api-reference"])
    );
    expect(knob.markdown).toContain("# Knob");
  });

  test("one section is that part alone", async () => {
    const knob = await body(
      componentResponse("knob", url("/components/knob?section=installation"))
    );
    expect(knob.section).toBe("installation");
    expect(knob.markdown).toContain("Run the command.");
    expect(knob.markdown).not.toContain("log scale");
  });

  test("an unknown section is a 400 that lists the sections", async () => {
    const response = await componentResponse(
      "knob",
      url("/components/knob?section=pricing")
    );
    expect(response.status).toBe(400);
    const error = await body(response);
    expect(error.message).toBe(
      'Invalid "section": knob has no section "pricing".'
    );
    expect(error.hint).toContain("api-reference");
  });

  test("an unknown name is a 404 that suggests the nearest", async () => {
    const response = await componentResponse("knobb", url("/components/knobb"));
    expect(response.status).toBe(404);
    const error = await body(response);
    expect(error.error).toBe("not_found");
    expect(error.hint).toStartWith("Did you mean knob? ");
  });
});

describe("GET /api/v1/search", () => {
  test("answers the sections that match, each linked through the API", async () => {
    const { hits, query, total } = await body(
      searchResponse(url("/search?q=log+scale"))
    );
    expect(query).toBe("log scale");
    expect(total).toBe(1);
    expect((hits as Record<string, unknown>[])[0]).toEqual(
      expect.objectContaining({
        api_url: `${API}/components/knob?section=api-reference`,
        component: "knob",
        section: "api-reference",
      })
    );
  });

  test("nothing matched says what to try", async () => {
    const results = await body(searchResponse(url("/search?q=theremin")));
    expect(results.total).toBe(0);
    expect(results.hint).toContain(`${API}/components`);
  });

  test.each([
    ["/search", '"q": required, the words to search for'],
    ["/search?q=a", '"q": at least 2 characters'],
    ["/search?q=knob&limit=50", '"limit": a whole number from 1 to 20'],
    ["/search?q=knob&limit=two", '"limit": a whole number from 1 to 20'],
  ])("%s is a 400: %s", async (path, problem) => {
    const response = await searchResponse(url(path));
    expect(response.status).toBe(400);
    expect((await body(response)).message).toBe(`Invalid ${problem}.`);
  });
});

describe("GET /api/v1/catalog", () => {
  test("lists every block without a query, a page at a time", async () => {
    expect(await body(catalogResponse(url("/catalog")))).toEqual(
      expect.objectContaining({ has_more: false, total: 2 })
    );
  });

  test("searches the blocks", async () => {
    const { items } = await body(catalogResponse(url("/catalog?q=synth")));
    expect(items).toEqual([
      expect.objectContaining({
        install: "npx shadcn@latest add @audio-ui/block-pocket-synth",
        name: "block-pocket-synth",
      }),
    ]);
  });

  test("a negative offset is a 400", () => {
    expect(catalogResponse(url("/catalog?offset=-1")).status).toBe(400);
  });
});

describe("methodResponse", () => {
  test("lets reads through", () => {
    expect(methodResponse("GET")).toBeUndefined();
    expect(methodResponse("HEAD")).toBeUndefined();
  });

  test("refuses writes with a 405 in JSON and the methods allowed", async () => {
    const response = methodResponse("POST");
    expect(response?.status).toBe(405);
    expect(response?.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(await response?.json()).toEqual(
      expect.objectContaining({ error: "method_not_allowed", status: 405 })
    );
  });

  test("answers a CORS preflight", () => {
    const response = methodResponse("OPTIONS");
    expect(response?.status).toBe(204);
    expect(response?.headers.get("access-control-allow-methods")).toBe(
      "GET, HEAD, OPTIONS"
    );
  });
});

describe("apiCatalogResponse", () => {
  const PROFILE =
    'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

  test("is a linkset of the APIs, with their description, docs and status (RFC 9727)", async () => {
    const response = apiCatalogResponse("GET");
    expect(response.headers.get("content-type")).toBe(PROFILE);
    const { linkset } = (await response.json()) as {
      linkset: Record<string, unknown>[];
    };
    expect(linkset[0]).toEqual({
      anchor: API,
      "service-desc": [
        { href: `${siteConfig.url}/openapi.json`, type: "application/json" },
      ],
      "service-doc": [
        { href: `${siteConfig.url}/docs/api`, type: "text/html" },
      ],
      status: [{ href: API, type: "application/json" }],
    });
    expect(linkset[1]?.anchor).toBe(`${siteConfig.url}/mcp`);
  });

  test("a HEAD gets the api-catalog Link and no body", async () => {
    const response = apiCatalogResponse("HEAD");
    expect(response.headers.get("link")).toBe(
      `<${siteConfig.url}/.well-known/api-catalog>; rel="api-catalog"`
    );
    expect(await response.text()).toBe("");
  });
});
