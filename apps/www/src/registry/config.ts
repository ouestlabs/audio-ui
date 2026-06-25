import { BASE_COLORS } from "@/registry/base-colors";
import { THEMES } from "@/registry/themes";

export type DesignSystemConfig = {
  baseColor: string;
  theme: string;
  radius: string;
  style: string;
  menuAccent?: string;
};

const RADIUS_CSS = Object.freeze({
  none: "0rem",
  sm: "0.25rem",
  default: "0.5rem",
  lg: "0.75rem",
});

const ACCENT_VAR_KEYS = [
  "primary",
  "primary-foreground",
  "ring",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

export function buildRegistryTheme(config: DesignSystemConfig) {
  const { baseColor, theme, radius, style, menuAccent } = config;

  const baseEntry = BASE_COLORS.find((t) => t.name === baseColor)?.cssVars;
  const themeEntry = THEMES.find((t) => t.name === theme)?.cssVars;
  const ZERO_RADIUS_STYLES = new Set(["base-lyra", "base-sera"]);
  const effectiveRadius = ZERO_RADIUS_STYLES.has(style) ? "none" : radius;
  const radiusValue =
    RADIUS_CSS[effectiveRadius as keyof typeof RADIUS_CSS] ??
    RADIUS_CSS.default;

  const merge = (mode: "light" | "dark"): Record<string, string> => {
    const source = (baseEntry?.[mode] ?? {}) as Record<string, string>;
    const { radius: _radius, ...vars } = source;
    const themeVars = themeEntry?.[mode] as Record<string, string> | undefined;
    if (themeVars) {
      for (const key of ACCENT_VAR_KEYS) {
        const val = themeVars[key];
        if (val) {
          vars[key] = val;
        }
      }
    }
    if (menuAccent === "bold") {
      vars.accent = vars.primary;
      vars["accent-foreground"] = vars["primary-foreground"];
    }
    return vars;
  };

  return {
    cssVars: {
      theme: { radius: radiusValue },
      light: merge("light"),
      dark: merge("dark"),
    },
  };
}
