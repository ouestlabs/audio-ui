import { describe, expect, test } from "bun:test";
import "./fixtures/agent-docs";
import { siteConfig } from "@/lib/config";
import { BUILT_STYLES } from "@/lib/registry/core/styles";

const { getOpenApiDocument } = await import("@/lib/agents/openapi");
const { RATE_LIMIT } = await import("@/lib/agents/rest-api");

const doc = getOpenApiDocument();
type Json = Record<string, unknown>;

const OPERATION_ID = /^[a-z][A-Za-z]+$/;
const PATH_PARAMETER = /\{(\w+)\}/g;
const METHODS = new Set(["get", "head", "post", "put", "patch", "delete"]);
/** The paths of the REST API, served from the top-level server. */
const API_PATHS = [
  "/",
  "/catalog",
  "/components",
  "/components/{name}",
  "/search",
];

/** Follows a local `$ref` such as `#/components/parameters/name`. */
function resolve(node: Json): Json {
  const ref = node.$ref;
  if (typeof ref !== "string") {
    return node;
  }
  let target: unknown = doc;
  for (const key of ref.replace("#/", "").split("/")) {
    target = (target as Json | undefined)?.[key];
  }
  if (!target) {
    throw new Error(`Unresolved $ref ${ref}`);
  }
  return target as Json;
}

const operations = Object.entries(doc.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([method]) => METHODS.has(method))
    .map(([method, operation]) => ({
      method,
      operation: operation as Json,
      path,
    }))
);

function refsIn(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(refsIn);
  }
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) =>
      key === "$ref" && typeof value === "string" ? [value] : refsIn(value)
    );
  }
  return [];
}

describe("getOpenApiDocument", () => {
  test("is OpenAPI 3.1, its server the REST API, versioned in the path", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers).toEqual([
      expect.objectContaining({ url: `${siteConfig.url}/api/v1` }),
    ]);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
  });

  test("serves every path outside the REST API from the site's root", () => {
    for (const [path, item] of Object.entries(doc.paths) as [string, Json][]) {
      if (API_PATHS.includes(path)) {
        expect(item.servers, path).toBeUndefined();
      } else {
        expect(item.servers, path).toEqual([
          expect.objectContaining({ url: siteConfig.url }),
        ]);
      }
    }
  });

  test("publishes the deprecation policy, naming both headers", () => {
    expect(doc.info.description).toContain("`Deprecation` header (RFC 9745)");
    expect(doc.info.description).toContain("`Sunset` header (RFC 8594)");
    expect(Object.keys(doc.components.headers)).toEqual(
      expect.arrayContaining(["Deprecation", "Sunset"])
    );
  });

  test("every success of the REST API declares the deprecation headers and the quota", () => {
    for (const { operation, path } of operations) {
      if (!API_PATHS.includes(path)) {
        continue;
      }
      const ok = (operation.responses as Record<string, Json>)["200"];
      expect(Object.keys(ok.headers as Json), path).toEqual([
        "Deprecation",
        "RateLimit-Policy",
        "Sunset",
      ]);
    }
  });

  test("states the rate limit it enforces, and every API operation its 429", () => {
    expect(doc.info.description).toContain(
      `\`"api";q=${RATE_LIMIT.quota};w=${RATE_LIMIT.window}\``
    );
    const tooMany = resolve({
      $ref: "#/components/responses/TooManyRequests",
    });
    expect(Object.keys(tooMany.headers as Json)).toEqual([
      "RateLimit",
      "RateLimit-Policy",
      "Retry-After",
    ]);
    for (const { operation, path } of operations) {
      if (API_PATHS.includes(path) || path === "/api") {
        expect(
          (operation.responses as Record<string, Json>)["429"],
          path
        ).toEqual({ $ref: "#/components/responses/TooManyRequests" });
      }
    }
  });

  test("every REST API error answers with the Error schema", () => {
    for (const { operation, path } of operations) {
      if (!API_PATHS.includes(path)) {
        continue;
      }
      const responses = operation.responses as Record<string, Json>;
      for (const [status, response] of Object.entries(responses)) {
        if (status.startsWith("4")) {
          const content = resolve(response).content as Json;
          expect(content["application/json"], `${path} ${status}`).toEqual({
            schema: { $ref: "#/components/schemas/Error" },
          });
        }
      }
    }
  });

  test("says that no operation needs a key", () => {
    expect(doc.security).toEqual([]);
  });

  test("every operation has a unique operationId, a summary and a description", () => {
    const ids = operations.map(({ operation }) => operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { operation } of operations) {
      expect(operation.operationId).toMatch(OPERATION_ID);
      expect(String(operation.summary).length).toBeGreaterThan(5);
      expect(String(operation.description).length).toBeGreaterThan(20);
    }
  });

  test("every path parameter is declared, required and typed", () => {
    for (const { operation, path } of operations) {
      const declared = ((operation.parameters as Json[] | undefined) ?? []).map(
        resolve
      );
      for (const [, name] of path.matchAll(PATH_PARAMETER)) {
        const parameter = declared.find(
          (p) => p.in === "path" && p.name === name
        );
        expect(parameter, `${path} declares {${name}}`).toBeDefined();
        expect(parameter?.required).toBe(true);
        expect((parameter?.schema as Json | undefined)?.type).toBe("string");
      }
    }
  });

  test("every success answers with a schema, every redirect with its Location", () => {
    for (const { operation, path } of operations) {
      const responses = operation.responses as Record<string, Json>;
      expect(Object.keys(responses).length, path).toBeGreaterThan(0);
      for (const [status, response] of Object.entries(responses)) {
        if (status === "200") {
          const content = Object.values(response.content as Json) as Json[];
          expect(
            content.every((media) => media.schema),
            path
          ).toBe(true);
        }
        if (status === "307") {
          expect((response.headers as Json).Location, path).toBeDefined();
        }
      }
    }
  });

  test("every $ref resolves", () => {
    for (const ref of refsIn(doc)) {
      expect(() => resolve({ $ref: ref })).not.toThrow();
    }
  });

  test("the style parameter lists the styles the registry is built in", () => {
    expect(doc.components.parameters.style.schema.enum).toEqual(BUILT_STYLES);
  });

  test("names the REST API, the registry, the markdown docs, llms.txt and the MCP server", () => {
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        ...API_PATHS,
        "/api",
        "/.well-known/api-catalog",
        "/r/styles/{style}/{name}.json",
        "/r/styles/{style}/registry.json",
        "/r/{style}/{name}.json",
        "/llm/components/base/{name}",
        "/llms.txt",
        "/mcp",
      ])
    );
  });
});
