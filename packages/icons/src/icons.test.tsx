import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { scalePath } from "./glyph.ts";
import * as icons from "./index.ts";
import { catalog, toSvg } from "./index.ts";

const components = Object.entries(icons).filter(
  ([name]) => name.endsWith("Icon") && name !== "createIcon"
) as [string, (props: icons.IconProps) => React.JSX.Element][];

const STROKE = /stroke-width="([\d.]+)"/;

describe("icons", () => {
  test("every glyph has an icon, and every icon a glyph", () => {
    expect(components.length).toBe(Object.keys(icons.glyphs).length);
  });

  for (const [name, Icon] of components) {
    test(`${name} draws in every weight`, () => {
      const regular = renderToStaticMarkup(<Icon />);
      const bold = renderToStaticMarkup(<Icon weight="bold" />);
      const _duotone = renderToStaticMarkup(<Icon weight="duotone" />);
      expect(regular).toContain('viewBox="0 0 24 24"');
      expect(regular).toContain('stroke-width="1.5"');
      expect(bold).toContain('stroke-width="2.25"');
    });
  }

  test("the glyphs of the sidebar's groups have a body in the duotone weight", () => {
    for (const Icon of [
      icons.MetronomeIcon,
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
        const strokeOf = (source: string) => source.match(STROKE)?.[1];
        expect(strokeOf(text)).toBe(strokeOf(markup));
        expect(text.includes("<mask")).toBe(markup.includes("<mask"));
        expect(text.includes("fill-opacity")).toBe(
          markup.includes("fill-opacity")
        );
      }
    }
  });

  test("a path scales around the middle of the grid, whatever its commands", () => {
    expect(scalePath("M2 12h20", 0.5)).toBe("M7 12h10");
    expect(scalePath("M2 12c2-4 4-4 6 0", 0.5)).toBe("M7 12c1-2 2-2 3 0");
    expect(scalePath("M4 4a2 2 0 0 1 4 0", 0.5)).toBe("M8 8a1 1 0 0 1 2 0");
  });

  test("a curve sits on a faint screen, solid in the fill weight with the curve cut out", () => {
    const regular = renderToStaticMarkup(<icons.LowpassIcon />);
    expect(regular).toContain('stroke-opacity="0.3"');
    expect(regular).toContain('fill-opacity="0.06"');
    const filled = renderToStaticMarkup(<icons.LowpassIcon weight="fill" />);
    expect(filled).toContain("<mask");
    expect(filled).not.toContain("stroke-opacity");
  });

  test("the fill weight is solid where a glyph has a body, and a bold line where it has none", () => {
    const filled = renderToStaticMarkup(<icons.KnobIcon weight="fill" />);
    expect(filled).toContain('fill="currentColor"');
    // The knob's mark is cut out of the disc.
    expect(filled).toContain("<mask");
    const line = renderToStaticMarkup(<icons.BracesIcon weight="fill" />);
    expect(line).toContain('stroke-width="2.25"');
    expect(line).not.toContain("<mask");
  });

  test("every knock detail of a solid glyph has a body to be cut from", () => {
    for (const item of catalog) {
      const glyph = icons.glyphs[item.glyph];
      if (glyph.some((shape) => shape.knock)) {
        expect(glyph.some((shape) => shape.tint || shape.backdrop)).toBe(true);
      }
    }
  });
});
