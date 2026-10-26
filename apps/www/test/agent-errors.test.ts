import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  type ApiError,
  jsonNotFound,
  markdownNotFound,
  missingResponse,
  notAcceptable,
  registryNotFound,
  withVary,
} from "@/lib/agents/errors";
import { siteConfig } from "@/lib/config";

/** What the shadcn CLI reads from a registry error before it prints `[error] message`. */
const shadcnError = z.object({
  error: z.string(),
  message: z.string(),
});

function request(path: string, accept?: string) {
  return new Request(`https://www.audio-ui.dev${path}`, {
    headers: accept ? { Accept: accept } : {},
  });
}

const ROUTER_404 = () =>
  new Response("<!doctype html><h1>Page Not Found</h1>", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: 404,
  });

describe("markdownNotFound", () => {
  test("is a 404 in markdown that names the address and links back in", async () => {
    const response = markdownNotFound("/nope");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("vary")).toBe("Accept");
    const body = await response.text();
    expect(body.startsWith("# Not found")).toBe(true);
    expect(body).toContain("`/nope`");
    expect(body).toContain(`(${siteConfig.url}/llms.txt)`);
    expect(body).toContain(`(${siteConfig.url}/sitemap.xml)`);
  });
});

describe("jsonNotFound", () => {
  test("is a 404 in JSON with a code, a message and a hint", async () => {
    const response = jsonNotFound("/api/nope");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("vary")).toBe("Accept");
    expect((await response.json()) as ApiError).toEqual({
      error: "not_found",
      hint: expect.stringContaining(`${siteConfig.url}/openapi.json`),
      message: "There is no page or API endpoint at /api/nope.",
      status: 404,
    });
  });
});

describe("registryNotFound", () => {
  test("answers in the shape the shadcn CLI prints, with where to look", async () => {
    const response = registryNotFound("base-nova", "nope");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as ApiError;
    expect(shadcnError.safeParse(body).success).toBe(true);
    expect(body.message).toBe(
      'The registry has no item "nope" in the style "base-nova".'
    );
    expect(body.hint).toContain(`${siteConfig.url}/r/registry.json`);
  });

  test("does not vary on Accept: the registry only speaks JSON", () => {
    expect(registryNotFound("base-nova", "nope").headers.get("vary")).toBe(
      null
    );
  });
});

describe("notAcceptable", () => {
  test("is a 406 that lists the forms the address has", async () => {
    const response = notAcceptable("application/pdf", [
      "text/html",
      "text/markdown",
    ]);
    expect(response.status).toBe(406);
    expect(response.headers.get("vary")).toBe("Accept");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe(
      "This resource is available in:\n- text/html\n- text/markdown\n\nYou requested: application/pdf\n"
    );
  });
});

describe("withVary", () => {
  test("adds Accept to what the response already varies on", async () => {
    const response = withVary(
      new Response("page", {
        headers: { Vary: "Accept-Encoding" },
        status: 201,
      })
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("vary")).toBe("Accept-Encoding, Accept");
    expect(await response.text()).toBe("page");
  });
});

describe("missingResponse", () => {
  test("an agent asking for markdown gets the markdown 404", async () => {
    const response = missingResponse(
      request("/nope", "text/markdown"),
      ROUTER_404()
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toContain("`/nope`");
  });

  test("a program asking for JSON gets the JSON 404", async () => {
    const response = missingResponse(
      request("/api/nope", "application/json"),
      ROUTER_404()
    );
    expect(response.status).toBe(404);
    expect(((await response.json()) as ApiError).error).toBe("not_found");
  });

  test("the registry answers JSON whatever the request accepts", () => {
    const response = missingResponse(
      request("/r/a/b/c.json", "text/html"),
      ROUTER_404()
    );
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("vary")).toBe("Accept");
  });

  test("a browser keeps the router's 404 page, which now varies on Accept", async () => {
    const response = missingResponse(
      request(
        "/nope",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      ),
      ROUTER_404()
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("vary")).toBe("Accept");
    expect(await response.text()).toContain("Page Not Found");
  });

  test("no Accept is a browser's default: the HTML page", () => {
    const response = missingResponse(request("/nope"), ROUTER_404());
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  test("a request that takes none of the three keeps the router's answer", () => {
    const routerResponse = Response.json(
      { error: "Only HTML requests are supported here" },
      { status: 406 }
    );
    expect(missingResponse(request("/nope", "image/png"), routerResponse)).toBe(
      routerResponse
    );
  });
});
