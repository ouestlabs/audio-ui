import { themeCss } from "@/lib/design-system/theme-vars";
import { SKIN_VARIABLES } from "@/lib/docs/content/element-skins";
import {
  DENSITIES,
  type DensityId,
  SIZES,
  type SizeId,
  type StylingId,
} from "@/lib/docs/content/stylings";
import { buildRegistryTheme, type DesignSystemConfig } from "@/registry/config";

/** The variables the elements' examples read, colors and radius: the theme's others have no use there. */
const USED = new Set([...SKIN_VARIABLES, "radius"]);

const used = (vars: Record<string, string>) =>
  Object.fromEntries(Object.entries(vars).filter(([key]) => USED.has(key)));

/** Tailwind's names for the variables: colors by name, and the radius scale the examples' classes use. */
const tailwindTheme = () =>
  [
    "@theme inline {",
    ...SKIN_VARIABLES.filter((name) => name !== "radius").map(
      (name) => `  --color-${name}: var(--${name});`
    ),
    "  --radius-sm: calc(var(--radius) - 4px);",
    "  --radius-md: calc(var(--radius) - 2px);",
    "  --radius-lg: var(--radius);",
    "}",
  ].join("\n");

/**
 * The theme on screen as a stylesheet for a project of its own, with no
 * registry: the variables the examples read (colors, radius, and the spacing
 * unit and density when they are not the default) on `:root` and `.dark`, as
 * the page applies them. For Tailwind, with the `@theme` that names them for
 * its classes.
 */
export function themeStylesheet(
  config: DesignSystemConfig,
  styling: StylingId,
  look: { density?: DensityId; size?: SizeId } = {}
): string {
  // The lyra style draws square corners whatever the radius, as the page does.
  const radius = config.style === "lyra" ? "none" : config.radius;
  const built = buildRegistryTheme({ ...config, radius }).cssVars;
  const size = SIZES.find((each) => each.id === look.size)?.factor ?? 1;
  const density =
    DENSITIES.find((each) => each.id === look.density)?.factor ?? 1;
  const variables = themeCss({
    dark: used(built.dark),
    light: {
      ...used(built.light),
      ...(size === 1 ? {} : { spacing: `${0.25 * size}rem` }),
      ...(density === 1 ? {} : { density: String(density) }),
    },
    theme: undefined,
  });
  return styling === "tailwind"
    ? `@import "tailwindcss";\n\n${tailwindTheme()}\n\n${variables}`
    : variables;
}
