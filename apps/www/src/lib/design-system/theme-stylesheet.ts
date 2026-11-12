import { themeCss } from "@/lib/design-system/theme-vars";
import { FONT_DEFINITIONS } from "@/lib/font-definitions";
import { buildRegistryTheme, type DesignSystemConfig } from "@/registry/config";

/** The registry's own variables: its charts' colors and its sidebar's. */
const REGISTRY_VAR = /^(chart-|sidebar)/;

/** A theme's variables without the registry's own. */
const ownVars = (vars: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(vars).filter(([key]) => !REGISTRY_VAR.test(key))
  );

/**
 * The theme on screen as a stylesheet for a project of its own, with no
 * registry: its font loaded from Google Fonts, then its variables (colors,
 * radius, `--font-sans`) on `:root` and `.dark`, as the page applies them,
 * without the registry's own (its charts' and its sidebar's).
 */
export function themeStylesheet(config: DesignSystemConfig): string {
  // The lyra style draws square corners whatever the radius, as the page does.
  const radius = config.style === "lyra" ? "none" : config.radius;
  const built = buildRegistryTheme({ ...config, radius }).cssVars;
  const cssVars = {
    dark: ownVars(built.dark),
    light: ownVars(built.light),
    theme: built.theme,
  };
  const font = FONT_DEFINITIONS.find((each) => each.name === config.font);
  if (!font) {
    return themeCss(cssVars);
  }
  const family = encodeURIComponent(font.title).replaceAll("%20", "+");
  const generic = font.family.split(",").at(-1)?.trim() ?? "sans-serif";
  return `@import url("https://fonts.googleapis.com/css2?family=${family}&display=swap");\n\n${themeCss(
    {
      ...cssVars,
      theme: { ...cssVars.theme, "font-sans": `"${font.title}", ${generic}` },
    }
  )}`;
}
