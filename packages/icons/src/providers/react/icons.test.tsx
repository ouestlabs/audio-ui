import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { catalog, glyphs, toSvg, WEIGHTS } from "../../core/index.ts";
import * as icons from "./index.tsx";
import { CurveIcon } from "./index.tsx";

const components = Object.entries(icons).filter(
  ([name]) =>
    name.endsWith("Icon") && name !== "createIcon" && name !== "CurveIcon"
) as [string, (props: icons.IconProps) => React.JSX.Element][];

const square = (input: number) => input * input;
const STROKE = /stroke-width="([\d.]+)"/;

describe("icons", () => {
  test("every glyph has an icon, and every icon a glyph", () => {
    expect(components.length).toBe(Object.keys(glyphs).length);
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
      icons.MidiIcon,
      icons.RackIcon,
      icons.VinylIcon,
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
      Object.keys(glyphs).sort()
    );
    for (const item of catalog) {
      const Icon = icons.icons[item.name as keyof typeof icons.icons];
      expect(renderToStaticMarkup(<Icon />)).toContain("<svg");
    }
  });

  test("toSvg draws what the icon renders", () => {
    for (const item of catalog) {
      const Icon = icons.icons[item.name as keyof typeof icons.icons];
      for (const weight of WEIGHTS) {
        const text = toSvg(glyphs[item.glyph], { weight });
        const markup = renderToStaticMarkup(<Icon weight={weight} />);
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

  test("the fill weight is solid where a glyph has a body, and a bold line where it has none", () => {
    const filled = renderToStaticMarkup(<icons.KnobIcon weight="fill" />);
    expect(filled).toContain('fill="currentColor"');
    // The knob's mark is cut out of the disc.
    expect(filled).toContain("<mask");
    const line = renderToStaticMarkup(<icons.BracesIcon weight="fill" />);
    expect(line).toContain('stroke-width="2.25"');
    expect(line).not.toContain("<mask");
  });

  test("a shape that sits on a line clears it, and is tinted or solid like any body", () => {
    const regular = renderToStaticMarkup(<icons.PlotIcon />);
    expect(regular).toContain("<mask");
    expect(regular).not.toContain('fill="currentColor"');
    expect(renderToStaticMarkup(<icons.PlotIcon weight="duotone" />)).toContain(
      'fill-opacity="0.2"'
    );
    const filled = renderToStaticMarkup(<icons.PlotIcon weight="fill" />);
    expect(filled).toContain('fill="currentColor"');
    expect(filled).toContain('stroke-width="1.5"');
  });

  test("every knock detail of a solid glyph has a body to be cut from", () => {
    for (const item of catalog) {
      const glyph = glyphs[item.glyph];
      if (glyph.some((shape) => shape.knock)) {
        expect(glyph.some((shape) => shape.tint || shape.backdrop)).toBe(true);
      }
    }
  });

  test("CurveIcon draws a function in the same svg as the other icons", () => {
    const markup = renderToStaticMarkup(
      <CurveIcon shape={square} weight="bold" />
    );
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('stroke-width="2.25"');
    expect(markup).toContain('d="M3 ');
  });
});
