import { themeCss } from "@/lib/design-system/theme-vars";
import { SKIN_VARIABLES } from "@/lib/docs/content/element-skins";
import type { StylingId } from "@/lib/docs/content/stylings";
import { FONT_DEFINITIONS } from "@/lib/font-definitions";
import { buildRegistryTheme, type DesignSystemConfig } from "@/registry/config";

/** The variables the elements' examples read, colors and radius: the theme's others have no use there. */
const USED = new Set([...SKIN_VARIABLES, "radius"]);

const used = (vars: Record<string, string>) =>
  Object.fromEntries(Object.entries(vars).filter(([key]) => USED.has(key)));

/** Tailwind's names for the variables: colors by name, and the radius scale the examples' classes use. */
const tailwindTheme = (font: string | undefined) =>
  [
    "@theme inline {",
    ...SKIN_VARIABLES.filter((name) => name !== "radius").map(
      (name) => `  --color-${name}: var(--${name});`
    ),
    "  --radius-sm: calc(var(--radius) - 4px);",
    "  --radius-md: calc(var(--radius) - 2px);",
    ...(font ? [`  --font-sans: ${font};`] : []),
    "}",
  ].join("\n");

/**
 * The theme on screen as a stylesheet for a project of its own, with no
 * registry: its font loaded from Google Fonts, then the variables the
 * examples read (colors, radius) on `:root` and `.dark`, as the page applies
 * them. For Tailwind, with the `@theme` that names them for its classes.
 */
export function themeStylesheet(
  config: DesignSystemConfig,
  styling: StylingId
): string {
  // The lyra style draws square corners whatever the radius, as the page does.
  const radius = config.style === "lyra" ? "none" : config.radius;
  const built = buildRegistryTheme({ ...config, radius }).cssVars;
  const font = FONT_DEFINITIONS.find((each) => each.name === config.font);
  const family = font
    ? `"${font.title}", ${font.family.split(",").at(-1)?.trim() ?? "sans-serif"}`
    : undefined;
  const variables = themeCss({
    dark: used(built.dark),
    light: {
      ...used(built.light),
      ...(family && styling === "css" ? { "font-sans": family } : {}),
    },
    theme: undefined,
  });
  const link = font
    ? `@import url("https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.title).replaceAll("%20", "+")}&display=swap");\n`
    : "";
  return styling === "tailwind"
    ? `${link}@import "tailwindcss";\n\n${tailwindTheme(family)}\n\n${variables}`
    : `${link}\n${variables}`;
}
