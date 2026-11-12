import { describe, expect, test } from "bun:test";
import { USAGES, withUsage } from "../scripts/element-usage.ts";

const PAGES = `${import.meta.dir}/../src/content/docs/elements`;

describe("Element usage", () => {
  test("every element page holds its usage in each framework, as the table writes it", async () => {
    const pages = await Promise.all(
      Object.keys(USAGES).map(async (page) => ({
        page,
        text: await Bun.file(`${PAGES}/${page}.mdx`).text(),
      }))
    );
    expect(
      pages
        .filter(({ page, text }) => withUsage(page, text) !== text)
        .map(({ page }) => page)
    ).toEqual([]);
  });
});
