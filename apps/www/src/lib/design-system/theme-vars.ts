import type { buildRegistryTheme } from "@/registry/config";

type ThemeCssVars = NonNullable<
  ReturnType<typeof buildRegistryTheme>["cssVars"]
>;

const THEME_STYLE_ID = "design-system-theme-vars";

function declarations(vars: Record<string, string> | undefined) {
  return Object.entries(vars ?? {})
    .filter(([, value]) => value)
    .map(([key, value]) => `  --${key}: ${value};\n`)
    .join("");
}

/** The `<style>` the theme's variables are written into, created on first use. */
export function getThemeStyleElement() {
  const existing = document.getElementById(THEME_STYLE_ID);
  if (existing instanceof HTMLStyleElement) {
    return { element: existing, existed: true };
  }
  const element = document.createElement("style");
  element.id = THEME_STYLE_ID;
  document.head.appendChild(element);
  return { element, existed: false };
}

/** A theme's variables as CSS: shared and light ones on `:root`, dark ones on `.dark`. */
export function themeCss({ dark, light, theme }: ThemeCssVars) {
  return `:root {\n${declarations(theme)}${declarations(light)}}\n\n.dark {\n${declarations(dark)}}\n`;
}

/** Writes a theme's variables into the page's `<style>`. */
export function writeThemeVars(element: HTMLStyleElement, vars: ThemeCssVars) {
  element.textContent = themeCss(vars);
}
