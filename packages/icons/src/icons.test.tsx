import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "./index.ts";
import { catalog, toSvg } from "./index.ts";

const components = Object.entries(icons).filter(
  ([name]) => name.endsWith("Icon") && name !== "createIcon"
) as [string, (props: icons.IconProps) => React.JSX.Element][];

describe("icons", () => {
  test("every glyph has an icon, and every icon a glyph", () => {
    expect(components.length).toBe(Object.keys(icons.glyphs).length);
  });

  for (const [name, Icon] of components) {
    test(`${name} draws in the three weights`, () => {
      const regular = renderToStaticMarkup(<Icon />);
      const bold = renderToStaticMarkup(<Icon weight="bold" />);
      const _duotone = renderToStaticMarkup(<Icon weight="duotone" />);
      expect(regular).toContain('viewBox="0 0 24 24"');
      expect(regular).toContain('stroke-width="1.5"');
      expect(bold).toContain('stroke-width="2.25"');
      expect(regular).not.toContain("fill-opacity");
    });
  }

  test("the glyphs of the sidebar's groups have a body in the duotone weight", () => {
    for (const Icon of [
      icons.FlagIcon,
      icons.KnobIcon,
      icons.TracksIcon,
      icons.RackIcon,
      icons.WaveformIcon,
    ]) {
      expect(renderToStaticMarkup(<Icon weight="duotone" />)).toContain(
        'fill-opacity="0.2"'
      );
    }
  });

  test("size sets the width and the height", () => {
    const markup = renderToStaticMarkup(<icons.SparkleIcon size={20} />);
    expect(markup).toContain('width="20"');
    expect(markup).toContain('height="20"');
  });

  test("the catalog lists every glyph once, in a category, with its icon", () => {
    expect(catalog.map((item) => item.glyph as string).sort()).toEqual(
      Object.keys(icons.glyphs).sort()
    );
    for (const item of catalog) {
      expect(renderToStaticMarkup(<item.Icon />)).toContain("<svg");
    }
  });

  test("toSvg draws what the icon renders", () => {
    for (const item of catalog) {
      for (const weight of icons.WEIGHTS) {
        const text = toSvg(icons.glyphs[item.glyph], { weight });
        const markup = renderToStaticMarkup(<item.Icon weight={weight} />);
        // The same shapes, in the same order.
        const draws = (source: string) =>
          [...source.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
        expect(draws(text)).toEqual(draws(markup));
        expect(text).toContain(
          `stroke-width="${weight === "bold" ? 2.25 : 1.5}"`
        );
        expect(text.includes("fill-opacity")).toBe(
          markup.includes("fill-opacity")
        );
      }
    }
  });
});
