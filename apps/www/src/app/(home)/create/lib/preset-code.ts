// Ported from shadcn/ui packages/shadcn/src/preset/preset.ts
// Bit-packs design system params into a single integer,
// then encodes as base62 with a version prefix character.
// Adapted to map audio-ui BuilderSearchParams → PresetConfig.

import type { BuilderSearchParams } from "./search-params";

// Order matters for backward-compat — never reorder, only append.
const PRESET_STYLES = [
  "nova",
  "vega",
  "maia",
  "lyra",
  "mira",
  "luma",
  "sera",
  "rhea",
] as const;

const PRESET_BASE_COLORS = [
  "neutral",
  "stone",
  "zinc",
  "gray",
  "mauve",
  "olive",
  "mist",
  "taupe",
] as const;

const PRESET_THEMES = [
  "neutral",
  "stone",
  "zinc",
  "gray",
  "amber",
  "blue",
  "cyan",
  "emerald",
  "fuchsia",
  "green",
  "indigo",
  "lime",
  "orange",
  "pink",
  "purple",
  "red",
  "rose",
  "sky",
  "teal",
  "violet",
  "yellow",
  "mauve",
  "olive",
  "mist",
  "taupe",
] as const;

const PRESET_CHART_COLORS = PRESET_THEMES;

const PRESET_ICON_LIBRARIES = [
  "lucide",
  "hugeicons",
  "tabler",
  "phosphor",
  "remixicon",
] as const;

const PRESET_FONTS = [
  "inter",
  "noto-sans",
  "nunito-sans",
  "figtree",
  "roboto",
  "raleway",
  "dm-sans",
  "public-sans",
  "outfit",
  "jetbrains-mono",
  "geist",
  "geist-mono",
  "lora",
  "merriweather",
  "playfair-display",
  "noto-serif",
  "roboto-slab",
  "oxanium",
  "manrope",
  "space-grotesk",
  "montserrat",
  "ibm-plex-sans",
  "source-sans-3",
  "instrument-sans",
  "eb-garamond",
  "instrument-serif",
] as const;

const PRESET_FONT_HEADINGS = ["inherit", ...PRESET_FONTS] as const;

const PRESET_RADII = ["default", "none", "small", "medium", "large"] as const;

const PRESET_MENU_ACCENTS = ["subtle", "bold"] as const;
const PRESET_MENU_COLORS = [
  "default",
  "inverted",
  "default-translucent",
  "inverted-translucent",
] as const;

// V2 fields: 51 bits total.
const PRESET_FIELDS = [
  { key: "menuColor", values: PRESET_MENU_COLORS, bits: 3 },
  { key: "menuAccent", values: PRESET_MENU_ACCENTS, bits: 3 },
  { key: "radius", values: PRESET_RADII, bits: 4 },
  { key: "font", values: PRESET_FONTS, bits: 6 },
  { key: "iconLibrary", values: PRESET_ICON_LIBRARIES, bits: 6 },
  { key: "theme", values: PRESET_THEMES, bits: 6 },
  { key: "baseColor", values: PRESET_BASE_COLORS, bits: 6 },
  { key: "style", values: PRESET_STYLES, bits: 6 },
  { key: "chartColor", values: PRESET_CHART_COLORS, bits: 6 },
  { key: "fontHeading", values: PRESET_FONT_HEADINGS, bits: 5 },
] as const;

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function toBase62(num: number): string {
  if (num === 0) return "0";
  let result = "";
  let n = num;
  while (n > 0) {
    result = BASE62[n % 62] + result;
    n = Math.floor(n / 62);
  }
  return result;
}

// Map audio-ui radius values to shadcn preset radius values.
const RADIUS_MAP: Record<string, string> = {
  none: "none",
  sm: "small",
  default: "default",
  lg: "large",
};

type PresetRecord = Record<string, string>;

function encodePreset(config: PresetRecord): string {
  let bits = 0;
  let offset = 0;
  for (const field of PRESET_FIELDS) {
    const idx = (field.values as readonly string[]).indexOf(
      config[field.key] ?? ""
    );
    bits += (idx === -1 ? 0 : idx) * 2 ** offset;
    offset += field.bits;
  }
  return "b" + toBase62(bits);
}

// Build the preset code from the builder search params.
export function getPresetCode(params: BuilderSearchParams): string {
  // Our styles are "base-luma" — shadcn preset uses "luma".
  const style = params.style.replace(/^base-/, "");
  const radius = RADIUS_MAP[params.radius] ?? "default";

  return encodePreset({
    style,
    baseColor: params.baseColor,
    theme: params.theme,
    radius,
    font: params.font,
    fontHeading: params.fontHeading,
    iconLibrary: params.iconLibrary,
    menuAccent: params.menuAccent,
    menuColor: params.menuColor,
    chartColor: "neutral",
  });
}
