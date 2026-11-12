import { describe, expect, test } from "bun:test";
import { withUsage } from "../scripts/react-usage.ts";
import { REACT_USAGES } from "../src/lib/docs/content/react-usage.ts";

const PAGES = `${import.meta.dir}/../src/content/docs/react`;

describe("React usage", () => {
  test("every primitive's page holds its usage in each styling, as the table writes it", async () => {
    const pages = await Promise.all(
      Object.keys(REACT_USAGES).map(async (page) => ({
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

  test("each page opens on its live preview, with its code inside it", async () => {
    const texts = await Promise.all(
      Object.keys(REACT_USAGES).map(async (page) => ({
        page,
        text: await Bun.file(`${PAGES}/${page}.mdx`).text(),
      }))
    );
    for (const { page, text } of texts) {
      const open = text.indexOf(`<ReactPreview name="${page}">`);
      expect(open).toBeGreaterThan(-1);
      // The code is what the preview shows under it: inside it, before the install and the API.
      expect(text.indexOf("usage:start")).toBeGreaterThan(open);
      expect(text.indexOf("</ReactPreview>")).toBeLessThan(
        text.indexOf("<Module")
      );
    }
  });
});
