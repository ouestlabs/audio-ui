import { usePathname } from "next/navigation";
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
import { FONTS } from "@/app/(create)/lib/fonts";
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

export const serializeDesignSystemSearchParams = createSerializer(
  designSystemSearchParams
);

/** What the hook returns where the URL carries no design params: none set, and nothing to write. */
const NO_PARAMS = loadDesignSystemSearchParams(new URLSearchParams());
const setNoParams = () => Promise.resolve(new URLSearchParams());

/** The home page and the catalog keep the design system in their URL, to share; elsewhere it lives in the saved config only. */
function carriesDesignParams(pathname: string) {
  return pathname === "/" || pathname.startsWith("/components");
}

export const useDesignSystemSearchParams = (options: Options = {}) => {
  const pathname = usePathname();
  const [params, setParams] = useQueryStates(designSystemSearchParams, {
    history: "push",
    shallow: true,
    ...options,
  });
  return carriesDesignParams(pathname)
    ? ([params, setParams] as const)
    : ([NO_PARAMS, setNoParams] as const);
};

export type DesignSystemSearchParams = inferParserType<
  typeof designSystemSearchParams
>;

export function isTranslucentMenuColor(
  menuColor?: MenuColorValue | null
): menuColor is "default-translucent" | "inverted-translucent" {
  return (
    menuColor === "default-translucent" || menuColor === "inverted-translucent"
  );
}
