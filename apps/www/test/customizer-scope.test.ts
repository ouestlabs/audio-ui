import { describe, expect, test } from "bun:test";
import { pageScope } from "@/lib/design-system/customizer-scope";
import { themeStylesheet } from "@/lib/design-system/theme-stylesheet";
import { DEFAULT_CONFIG } from "@/registry/config";

const DOCS = `${import.meta.dir}/../src/content/docs`;
const LIGHT_PRIMARY = /:root \{[^}]*--primary:/;
const DARK_PRIMARY = /\.dark \{[^}]*--primary:/;
const NO_RADIUS = /--radius: 0(rem)?;/;
const scopeOf = async (path: string) =>
  pageScope(await Bun.file(`${DOCS}/${path}`).text());

describe("pageScope", () => {
  test("a registry component's page follows every choice", async () => {
    expect(await scopeOf("components/base/(elements)/knob.mdx")).toBe("all");
  });

  test("a source alone follows them too: its code changes with the icon library", () => {
    expect(pageScope('<ComponentSource name="x" />')).toBe("all");
  });

  test("an element's page follows the elements' choices", async () => {
    expect(await scopeOf("elements/knob.mdx")).toBe("elements");
  });

  test("a page with no preview follows none", async () => {
    expect(await scopeOf("core/knob.mdx")).toBe("none");
    expect(await scopeOf("react/knob.mdx")).toBe("none");
    expect(await scopeOf("elements/index.mdx")).toBe("none");
  });
});

describe("themeStylesheet", () => {
  const css = themeStylesheet(DEFAULT_CONFIG);

  test("loads the font first, then names it", () => {
    expect(css.startsWith('@import url("https://fonts.googleapis.com/')).toBe(
      true
    );
    expect(css).toContain("--font-sans:");
  });

  test("holds the light and the dark colors", () => {
    expect(css).toMatch(LIGHT_PRIMARY);
    expect(css).toMatch(DARK_PRIMARY);
  });

  test("leaves out the registry's own variables", () => {
    expect(css).not.toContain("--chart-");
    expect(css).not.toContain("--sidebar");
  });

  test("the lyra style has square corners, whatever the radius", () => {
    const lyra = themeStylesheet({
      ...DEFAULT_CONFIG,
      radius: "large",
      style: "lyra",
    });
    expect(lyra).toMatch(NO_RADIUS);
  });
});
