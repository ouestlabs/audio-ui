import { useQueryStates } from "nuqs";
import {
  createLoader,
  createSerializer,
  type inferParserType,
  type Options,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import * as React from "react";
import { useConfig } from "@/hooks/use-config";
import { FONTS } from "@/lib/design-system/fonts";
import {
  DEFAULT_PRESET_CODE,
  getPresetCode,
  PRESET_KEYS,
  readPresetCode,
} from "@/lib/design-system/preset-code";
import {
  BASE_COLORS,
  BASES,
  type BaseColorName,
  type BaseName,
  type ChartColorName,
  type FontHeadingValue,
  type FontValue,
  type IconLibraryName,
  iconLibraries,
  MENU_ACCENTS,
  MENU_COLORS,
  type MenuAccentValue,
  type MenuColorValue,
  RADII,
  type RadiusValue,
  STYLES,
  type StyleName,
  THEMES,
  type ThemeName,
} from "@/registry/config";

const fontHeadingLiterals = [
  "inherit",
  ...FONTS.map((f) => f.value),
] as const satisfies readonly FontHeadingValue[];

const designSystemSearchParams = {
  base: parseAsStringLiteral<BaseName>(BASES.map((b) => b.name)),
  baseColor: parseAsStringLiteral<BaseColorName>(
    BASE_COLORS.map((b) => b.name)
  ),
  chartColor: parseAsStringLiteral<ChartColorName>(THEMES.map((t) => t.name)),
  custom: parseAsBoolean,
  font: parseAsStringLiteral<FontValue>(FONTS.map((f) => f.value)),
  fontHeading: parseAsStringLiteral<FontHeadingValue>(fontHeadingLiterals),
  iconLibrary: parseAsStringLiteral<IconLibraryName>(
    Object.values(iconLibraries).map((i) => i.name)
  ),
  item: parseAsString.withOptions({ shallow: true }),
  menuAccent: parseAsStringLiteral<MenuAccentValue>(
    MENU_ACCENTS.map((a) => a.value)
  ),
  menuColor: parseAsStringLiteral<MenuColorValue>(
    MENU_COLORS.map((m) => m.value)
  ),
  preset: parseAsString,
  radius: parseAsStringLiteral<RadiusValue>(RADII.map((r) => r.name)),
  search: parseAsString.withOptions({ shallow: true }),
  size: parseAsInteger,
  style: parseAsStringLiteral<StyleName>(STYLES.map((s) => s.name)),
  template: parseAsStringLiteral(["next", "start", "vite"] as const),
  theme: parseAsStringLiteral<ThemeName>(THEMES.map((t) => t.name)),
};

export const loadDesignSystemSearchParams = createLoader(
  designSystemSearchParams
);

const serializeParams = createSerializer(designSystemSearchParams);

export type DesignSystemSearchParams = inferParserType<
  typeof designSystemSearchParams
>;

type PresetKey = (typeof PRESET_KEYS)[number];

const isPresetKey = (key: string): key is PresetKey =>
  (PRESET_KEYS as readonly string[]).includes(key);

/**
 * The URL's design: the choices of its `preset` code when it carries one, else
 * the separate parameters older links use. A code wins, so a link made today
 * reads the same wherever it is opened.
 */
function withPreset(raw: DesignSystemSearchParams): DesignSystemSearchParams {
  const decoded = raw.preset ? readPresetCode(raw.preset) : null;
  return decoded ? { ...raw, ...decoded } : raw;
}

/** The design in a set of params as one code, or null when it is the default one: nothing to put in a link. */
function presetOf(values: Partial<Record<PresetKey, string | null>>) {
  const set: Partial<Record<PresetKey, string>> = {};
  for (const key of PRESET_KEYS) {
    const value = values[key];
    if (value) {
      set[key] = value;
    }
  }
  const code = getPresetCode(set);
  return code === DEFAULT_PRESET_CODE ? null : code;
}

/** Params as a link's query: the design as the one `preset` code, whatever else the params hold as itself. */
export function serializeDesignSystemSearchParams(
  base: string,
  params: Partial<DesignSystemSearchParams>
) {
  const { preset: _preset, ...rest } = params;
  const others = Object.fromEntries(
    Object.entries(rest).filter(([key]) => !isPresetKey(key))
  );
  return serializeParams(base, { ...others, preset: presetOf(rest) });
}

/**
 * The design system's URL state. The design is one `preset` code (what shadcn
 * uses): reading gives its choices as the separate fields the customizer
 * works with, writing puts the whole design back as one code, replacing the
 * page's history entry, and clears the separate parameters old links carried.
 */
export const useDesignSystemSearchParams = (options: Options = {}) => {
  const [raw, setRaw] = useQueryStates(designSystemSearchParams, {
    history: "push",
    shallow: true,
    ...options,
  });
  const [config] = useConfig();
  const params = React.useMemo(() => withPreset(raw), [raw]);

  const setParams = React.useCallback(
    (update: Partial<DesignSystemSearchParams>) => {
      const designKeys = Object.keys(update).filter(isPresetKey);
      if (designKeys.length === 0) {
        return setRaw(update);
      }
      const next: Partial<Record<PresetKey, string | null>> = {};
      for (const key of PRESET_KEYS) {
        next[key] = params[key] ?? config[key];
      }
      for (const key of designKeys) {
        next[key] = update[key] ?? null;
      }
      const cleared = Object.fromEntries(PRESET_KEYS.map((key) => [key, null]));
      const { preset: _preset, ...others } = update;
      return setRaw(
        { ...others, ...cleared, preset: presetOf(next) },
        { history: "replace" }
      );
    },
    [config, params, setRaw]
  );

  return [params, setParams] as const;
};

export function isTranslucentMenuColor(
  menuColor?: MenuColorValue | null
): menuColor is "default-translucent" | "inverted-translucent" {
  return (
    menuColor === "default-translucent" || menuColor === "inverted-translucent"
  );
}
