import {
  createSerializer,
  type inferParserType,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { THEMES } from "@/lib/themes";
import { baseColorsOKLCH } from "@/registry/base-colors";
import { STYLES } from "@/registry/styles";

export const BASE_COLOR_NAMES = Object.keys(baseColorsOKLCH) as Array<
  keyof typeof baseColorsOKLCH
>;

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

const THEME_NAMES = THEMES.map((t) => t.name) as [string, ...string[]];
const STYLE_VALUES = [...STYLES] as [string, ...string[]];
const BASE_COLORS = BASE_COLOR_NAMES as [string, ...string[]];

export const builderSearchParams = {
  style: parseAsStringLiteral(STYLE_VALUES).withDefault("base-luma"),
  theme: parseAsString.withDefault(THEME_NAMES[0] ?? "neutral"),
  baseColor: parseAsStringLiteral(BASE_COLORS).withDefault("neutral"),
  radius: parseAsStringLiteral(RADIUS_VALUES).withDefault("default"),
  font: parseAsString.withDefault("inter"),
  fontHeading: parseAsString.withDefault("inherit"),
  iconLibrary:
    parseAsStringLiteral(ICON_LIBRARY_VALUES).withDefault("phosphor"),
  mode: parseAsStringLiteral(MODE_VALUES).withDefault("light"),
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
