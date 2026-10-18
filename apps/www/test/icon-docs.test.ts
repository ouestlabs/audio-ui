import { describe, expect, test } from "bun:test";
import { catalog } from "@audio-ui/icons";
import {
  expandIconCatalog,
  iconCatalogTable,
} from "@/lib/docs/content/icon-docs";

const PAGE = `${import.meta.dir}/../src/content/docs/(root)/icons.mdx`;

describe("the icons page", () => {
  test("the table lists every icon of the package with its component", () => {
    const table = iconCatalogTable();
    for (const entry of catalog) {
      expect(table).toContain(`\`${entry.name}Icon\``);
    }
    expect(table.split("\n")).toHaveLength(catalog.length + 2);
  });

  test("the page's tag becomes the table, for the markdown pages", async () => {
    const mdx = await Bun.file(PAGE).text();
    expect(mdx).toContain("<IconCatalog />");
    const expanded = expandIconCatalog(mdx);
    expect(expanded).not.toContain("<IconCatalog");
    expect(expanded).toContain("| Knob | `KnobIcon` | Controls |");
  });

  test("a keyword is how a reader finds an icon, and no two icons share a name", () => {
    expect(new Set(catalog.map((entry) => entry.name)).size).toBe(
      catalog.length
    );
    for (const entry of catalog) {
      expect(entry.keywords.length).toBeGreaterThan(0);
    }
  });
});
