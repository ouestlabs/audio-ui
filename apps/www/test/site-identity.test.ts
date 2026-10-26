import { describe, expect, mock, test } from "bun:test";
import { siteConfig } from "@/lib/config";

// The docs source and the registry are built by Vite (import.meta.glob): a
// small stand-in of each lets llms.txt and the JSON-LD be read here.
mock.module("@/lib/docs/content/source", () => ({
  source: {
    getPages: () => [
      {
        data: { description: "Start here.", title: "Introduction" },
        slugs: [],
        url: "/docs",
      },
    ],
    getPageTree: () => ({ children: [] }),
  },
}));
mock.module("@/lib/registry/core/registry", () => ({
  getAllCatalogItems: () => [{}, {}, {}],
  getCategoryDocsDescription: () => undefined,
}));

const { getLlmsTxt } = await import("@/lib/agents/llms");
const { buildOrganizationJsonLd } = await import("@/lib/seo/seo");

const FILE_LIST_ITEM = /^- \[[^\]]+\]\([^)]+\)/;

/** What llms.txt holds before its first H2: the title, the summary and the details. */
function head(llms: string) {
  return llms.slice(0, llms.indexOf("\n## "));
}

describe("llms.txt", () => {
  const llms = getLlmsTxt();

  test("opens with the H1 and the summary, as llmstxt.org lays it out", () => {
    expect(llms.startsWith("# audio/ui\n\n> ")).toBe(true);
  });

  test("tells an agent when to use audio/ui, and when not", () => {
    const details = head(llms);
    expect(details).toContain("When to use audio/ui:");
    expect(details).toContain("It is not made for React Native");
    expect(details).toContain("`@audio-ui/core`");
  });

  test("tells an agent how to use it, step by step", () => {
    expect(head(llms)).toContain("How an agent should use it:");
    expect(head(llms)).toContain("1. Pick the layer:");
  });

  test("puts no heading in the details, which llms.txt does not allow", () => {
    const lines = head(llms).split("\n").slice(1);
    expect(lines.filter((line) => line.startsWith("#"))).toEqual([]);
  });

  test("links the OpenAPI description, the registry index and the CLI", () => {
    expect(llms).toContain(`(${siteConfig.url}/openapi.json)`);
    expect(llms).toContain(`(${siteConfig.url}/r/registry.json)`);
    expect(llms).toContain("[shadcn CLI](https://ui.shadcn.com/docs/cli)");
  });

  test("links the pages that say who runs the site", () => {
    for (const page of ["about", "contact", "privacy"]) {
      expect(llms).toContain(`(${siteConfig.url}/${page})`);
    }
  });

  test("every list item under an H2 is a link, as llms.txt file lists are", () => {
    const sections = llms.slice(llms.indexOf("\n## "));
    const items = sections.split("\n").filter((line) => line.startsWith("- "));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).toMatch(FILE_LIST_ITEM);
    }
  });
});

describe("buildOrganizationJsonLd", () => {
  const organization = buildOrganizationJsonLd();

  test("describes the organization", () => {
    expect(organization.description.length).toBeGreaterThan(50);
  });

  test("names a contact point with an email and its type", () => {
    expect(organization.contactPoint).toEqual({
      "@type": "ContactPoint",
      availableLanguage: "en",
      contactType: "technical support",
      email: siteConfig.email,
      url: `${siteConfig.url}/contact`,
    });
  });
});
