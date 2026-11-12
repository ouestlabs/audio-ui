import { describe, expect, test } from "bun:test";
import { pageScope } from "@/lib/design-system/customizer-scope";
import { themeStylesheet } from "@/lib/design-system/theme-stylesheet";
import { SKIN_VARIABLES } from "@/lib/docs/content/element-skins";
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

  test("an element's page, and a React primitive's with a preview, follow the elements' choices", async () => {
    expect(await scopeOf("elements/knob.mdx")).toBe("elements");
    expect(await scopeOf("react/knob.mdx")).toBe("elements");
  });

  test("a page with no preview follows none", async () => {
    expect(await scopeOf("core/knob.mdx")).toBe("none");
    expect(await scopeOf("elements/index.mdx")).toBe("none");
  });
});

describe("themeStylesheet", () => {
  const css = themeStylesheet(DEFAULT_CONFIG, "css");
  const tailwind = themeStylesheet(DEFAULT_CONFIG, "tailwind");

  test("holds the light and the dark colors the examples read", () => {
    expect(css).toMatch(LIGHT_PRIMARY);
    expect(css).toMatch(DARK_PRIMARY);
    for (const name of SKIN_VARIABLES) {
      expect(css).toContain(`--${name}:`);
    }
  });

  test("leaves out what the examples do not read", () => {
    expect(css).not.toContain("--chart-");
    expect(css).not.toContain("--sidebar");
    expect(css).not.toContain("--destructive");
  });

  test("writes the spacing unit and the density only when they are not the default", () => {
    expect(css).not.toContain("--spacing");
    const roomy = themeStylesheet(DEFAULT_CONFIG, "css", {
      density: "roomy",
      size: "large",
    });
    expect(roomy).toContain("--spacing: 0.3125rem;");
    expect(roomy).toContain("--density: 1.5;");
  });

  test("the lyra style has square corners, whatever the radius", () => {
    const lyra = themeStylesheet(
      { ...DEFAULT_CONFIG, radius: "large", style: "lyra" },
      "css"
    );
    expect(lyra).toMatch(NO_RADIUS);
  });

  test("for Tailwind, names the colors and the radius scale its classes use", () => {
    expect(tailwind).toContain('@import "tailwindcss";');
    expect(tailwind).toContain("@theme inline {");
    expect(tailwind).toContain("--color-primary: var(--primary);");
    expect(tailwind).toContain("--radius-md: calc(var(--radius) - 2px);");
  });
});
