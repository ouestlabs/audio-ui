import { describe, expect, test } from "bun:test";
import {
  stylingBlock,
  USAGES,
  usageBlock,
  withAll,
  withStyling,
} from "../scripts/element-usage.ts";
import { SKINS } from "../src/lib/docs/content/element-skins.ts";

const PAGES = `${import.meta.dir}/../src/content/docs/elements`;
const TAG = /<(audio-ui-[a-z-]+)/g;
const CSS_TAG = /audio-ui-[a-z-]+/g;
const PLURAL = /s$/;
const PLURAL_IES = /ies$/;

describe("Element usage", () => {
  test("every element page holds its usage in each framework and styling, as the table writes it", async () => {
    const pages = await Promise.all(
      Object.keys(USAGES).map(async (page) => ({
        page,
        text: await Bun.file(`${PAGES}/${page}.mdx`).text(),
      }))
    );
    expect(
      pages
        .filter(({ page, text }) => withAll(page, text) !== text)
        .map(({ page }) => page)
    ).toEqual([]);
  });

  test("the overview holds the theme variables as the default theme writes them", async () => {
    const text = await Bun.file(`${PAGES}/index.mdx`).text();
    expect(text).toContain(stylingBlock());
    expect(withStyling(text)).toBe(text);
  });

  test("every element has a skin, and every skin an element", () => {
    expect(Object.keys(SKINS).sort()).toEqual(Object.keys(USAGES).sort());
  });

  test("the Tailwind examples carry the classes of each part they hold, the CSS ones the stylesheet", () => {
    for (const [page, usage] of Object.entries(USAGES)) {
      const skin = SKINS[page];
      const block = usageBlock(page) ?? "";
      const tags = new Set(
        [usage.root, ...usage.inner].flatMap((line) =>
          [...line.matchAll(TAG)].map((match) => match[1] ?? "")
        )
      );
      for (const tag of tags) {
        const classes = skin?.tailwind[tag];
        if (classes) {
          expect(block).toContain(`class="${classes}"`);
        }
      }
      expect(block).toContain(skin?.css.split("\n")[0] ?? "missing");
    }
  });

  test("a part is styled the same way in both: the stylesheet and the classes name the same parts", () => {
    for (const [page, skin] of Object.entries(SKINS)) {
      const inCss = new Set(skin.css.match(CSS_TAG));
      const classed = new Set(Object.keys(skin.tailwind));
      // A part with classes is styled in the stylesheet too, itself or through the children it generates.
      for (const tag of classed) {
        const covered =
          inCss.has(tag) ||
          [...inCss].some((name) =>
            name.startsWith(tag.replace(PLURAL_IES, "y").replace(PLURAL, ""))
          );
        expect({ page, tag, covered }).toEqual({ covered: true, page, tag });
      }
    }
  });
});
