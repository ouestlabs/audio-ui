import { describe, expect, test } from "bun:test";
import { getOpenApiDocument } from "@/lib/agents/openapi";
import { siteConfig } from "@/lib/config";
import { BUILT_STYLES } from "@/lib/registry/core/styles";

const doc = getOpenApiDocument();
type Json = Record<string, unknown>;

const OPERATION_ID = /^[a-z][A-Za-z]+$/;
const PATH_PARAMETER = /\{(\w+)\}/g;

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
  Object.entries(item).map(([method, operation]) => ({
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
  test("is OpenAPI 3.1, served from the site's own origin", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers).toEqual([
      { description: "Production", url: siteConfig.url },
    ]);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
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

  test("names the registry, the markdown docs, llms.txt and the MCP server", () => {
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
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
