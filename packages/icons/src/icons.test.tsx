import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "./index.ts";

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
});
