import { expect, test } from "bun:test";
import {
  expandRegistryItems,
  namesOf,
  REFERENCE_ITEMS,
} from "@/lib/docs/content/registry-items";

const PAGES = ["hooks", "libraries", "utilities"];
const TAG = /<RegistryItems\s+names="([^"]*)"\s*\/>/g;

/** The reference pages' MDX, by page. */
const pages = await Promise.all(
  PAGES.map(async (page) => ({
    page,
    text: await Bun.file(
      new URL(`../src/content/docs/reference/${page}.mdx`, import.meta.url)
    ).text(),
  }))
);
const listed = pages.flatMap(({ page, text }) =>
  [...text.matchAll(TAG)].flatMap((match) =>
    namesOf(match[1] ?? "").map((name) => ({ name, page }))
  )
);

test("every hook and lib of the registry is listed on a reference page, once", () => {
  const counts = new Map<string, number>();
  for (const { name } of listed) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const missing = REFERENCE_ITEMS.filter((name) => !counts.has(name));
  const twice = [...counts].filter(([, count]) => count > 1).map(([n]) => n);
  expect({ missing, twice }).toEqual({ missing: [], twice: [] });
});

test("a reference page lists only what the registry installs, as the table an agent reads", () => {
  for (const { text } of pages) {
    const markdown = expandRegistryItems(text);
    expect(markdown).not.toContain("<RegistryItems");
    expect(markdown).toContain("| `@audio-ui/");
  }
});
