import {
  createSerializer,
  type inferParserType,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { BASE_COLORS } from "@/registry/base-colors";
import { STYLES } from "@/registry/styles";
import { THEMES } from "@/registry/themes";

export const BASE_COLOR_NAMES = BASE_COLORS.map((t) => t.name);

export const RADIUS_VALUES = ["none", "sm", "default", "lg"] as const;
export type RadiusValue = (typeof RADIUS_VALUES)[number];

export const RADIUS_LABELS: Record<RadiusValue, string> = {
  none: "None",
  sm: "Small",
  default: "Default",
  lg: "Large",
};

export const RADIUS_CSS: Record<RadiusValue, string> = {
  none: "0rem",
  sm: "0.25rem",
  default: "0.5rem",
  lg: "0.75rem",
};

export const MODE_VALUES = ["light", "dark"] as const;
export type ModeValue = (typeof MODE_VALUES)[number];

export const ICON_LIBRARY_VALUES = ["phosphor"] as const;
export type IconLibraryValue = (typeof ICON_LIBRARY_VALUES)[number];

export const MENU_COLOR_VALUES = [
  "default",
  "inverted",
  "default-translucent",
  "inverted-translucent",
] as const;
export type MenuColorValue = (typeof MENU_COLOR_VALUES)[number];
export const MENU_COLOR_LABELS: Record<MenuColorValue, string> = {
  default: "Default",
  inverted: "Inverted",
  "default-translucent": "Default Translucent",
  "inverted-translucent": "Inverted Translucent",
};

export const MENU_ACCENT_VALUES = ["subtle", "bold"] as const;
export type MenuAccentValue = (typeof MENU_ACCENT_VALUES)[number];
export const MENU_ACCENT_LABELS: Record<MenuAccentValue, string> = {
  subtle: "Subtle",
  bold: "Bold",
};

const THEME_NAMES = THEMES.map((t) => t.name);
const STYLE_VALUES = STYLES.map((s) => s.name);

export const builderSearchParams = {
  style: parseAsStringLiteral(STYLE_VALUES).withDefault("base-luma"),
  theme: parseAsString.withDefault(THEME_NAMES[0] ?? "neutral"),
  baseColor: parseAsStringLiteral(BASE_COLOR_NAMES).withDefault("neutral"),
  radius: parseAsStringLiteral(RADIUS_VALUES).withDefault("default"),
  font: parseAsString.withDefault("inter"),
  fontHeading: parseAsString.withDefault("inherit"),
  iconLibrary:
    parseAsStringLiteral(ICON_LIBRARY_VALUES).withDefault("phosphor"),
  mode: parseAsStringLiteral(MODE_VALUES).withDefault("light"),
  menuColor: parseAsStringLiteral(MENU_COLOR_VALUES).withDefault(
    "inverted-translucent"
  ),
  menuAccent: parseAsStringLiteral(MENU_ACCENT_VALUES).withDefault("subtle"),
};

export type BuilderSearchParams = inferParserType<typeof builderSearchParams>;

export function useBuilderSearchParams() {
  return useQueryStates(builderSearchParams, {
    shallow: true,
    history: "replace",
  });
}

export const serializeBuilderSearchParams =
  createSerializer(builderSearchParams);
