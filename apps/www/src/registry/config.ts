import {
  type IconLibrary,
  type IconLibraryName,
  iconLibraries,
} from "shadcn/icons";
import { type RegistryItem, registryItemSchema } from "shadcn/schema";
import { z } from "zod";

import { BASE_COLORS, type BaseColor } from "@/registry/base-colors";
import { BASES, type Base } from "@/registry/bases";
import { bodyFonts, fonts, headingFonts } from "@/registry/fonts";
import { STYLES, type Style } from "@/registry/styles";
import { THEMES, type Theme } from "@/registry/themes";

const SHADCN_VERSION = "latest";
const DEFAULT_RADIUS_VALUE = "0.625rem";

export {
  BASE_COLORS,
  BASES,
  type Base,
  type BaseColor,
  bodyFonts,
  fonts,
  headingFonts,
  type IconLibrary,
  type IconLibraryName,
  iconLibraries,
  STYLES,
  type Style,
  THEMES,
  type Theme,
};

export type BaseName = Base["name"];
export type StyleName = Style["name"];
export type ThemeName = Theme["name"];
export type BaseColorName = BaseColor["name"];
export type ChartColorName = Theme["name"];
export const REGISTRY_BASE_PARTS = ["theme", "font"] as const;
export type RegistryBasePart = (typeof REGISTRY_BASE_PARTS)[number];
export const POINTER_CURSOR_SELECTOR =
  'button:not(:disabled), [role="button"]:not(:disabled)';

// Derive font values from registry fonts (e.g., "font-inter" -> "inter").
const fontValues = bodyFonts.map((f) => f.name.replace("font-", "")) as [
  string,
  ...string[],
];
const fontHeadingValues = ["inherit", ...fontValues] as const;

export type FontValue = (typeof fontValues)[number];
export type FontHeadingValue = (typeof fontHeadingValues)[number];

export function getBodyFont(font: FontValue) {
  return bodyFonts.find((item) => item.name === `font-${font}`);
}

export function getHeadingFont(
  fontHeading: Exclude<FontHeadingValue, "inherit">
) {
  return headingFonts.find(
    (item) => item.name === `font-heading-${fontHeading}`
  );
}

export function getInheritedHeadingFontValue(font: FontValue) {
  return `var(${getBodyFont(font)?.font.variable ?? "--font-sans"})`;
}

export const MENU_ACCENTS = [
  { label: "Subtle", value: "subtle" },
  { label: "Bold", value: "bold" },
] as const;

export type MenuAccent = (typeof MENU_ACCENTS)[number];
export type MenuAccentValue = MenuAccent["value"];

export const MENU_COLORS = [
  { label: "Default", value: "default" },
  { label: "Inverted", value: "inverted" },
  { label: "Default Translucent", value: "default-translucent" },
  { label: "Inverted Translucent", value: "inverted-translucent" },
] as const;

export type MenuColor = (typeof MENU_COLORS)[number];

export type MenuColorValue = MenuColor["value"];

export const RADII = [
  { label: "Default", name: "default", value: "" },
  { label: "None", name: "none", value: "0" },
  { label: "Small", name: "small", value: "0.45rem" },
  { label: "Medium", name: "medium", value: "0.625rem" },
  { label: "Large", name: "large", value: "0.875rem" },
] as const;

export type Radius = (typeof RADII)[number];

export type RadiusValue = Radius["name"];

export const designSystemConfigSchema = z
  .object({
    base: z.enum(BASES.map((b) => b.name) as [BaseName, ...BaseName[]]),
    baseColor: z
      .enum(
        BASE_COLORS.map((c) => c.name) as [BaseColorName, ...BaseColorName[]]
      )
      .default("neutral"),
    chartColor: z
      .enum(THEMES.map((t) => t.name) as [ChartColorName, ...ChartColorName[]])
      .optional(),
    font: z.enum(fontValues).default("inter"),
    fontHeading: z.enum(fontHeadingValues).default("inherit"),
    iconLibrary: z.enum(
      Object.keys(iconLibraries) as [IconLibraryName, ...IconLibraryName[]]
    ),
    item: z.string().optional(),
    menuAccent: z
      .enum(
        MENU_ACCENTS.map((a) => a.value) as [
          MenuAccentValue,
          ...MenuAccentValue[],
        ]
      )
      .default("subtle"),
    menuColor: z
      .enum(
        MENU_COLORS.map((m) => m.value) as [MenuColorValue, ...MenuColorValue[]]
      )
      .default("default"),
    pointer: z.boolean().default(false),
    radius: z
      .enum(RADII.map((r) => r.name) as [RadiusValue, ...RadiusValue[]])
      .default("default"),
    rtl: z.boolean().default(false),
    style: z.enum(STYLES.map((s) => s.name) as [StyleName, ...StyleName[]]),
    template: z
      .enum([
        "next",
        "next-monorepo",
        "start",
        "react-router",
        "vite",
        "vite-monorepo",
        "react-router-monorepo",
        "start-monorepo",
        "astro",
        "astro-monorepo",
        "laravel",
      ])
      .default("next")
      .optional(),
    theme: z.enum(THEMES.map((t) => t.name) as [ThemeName, ...ThemeName[]]),
  })
  .transform((data) => ({
    ...data,
    chartColor: data.chartColor ?? data.theme,
  }))
  .refine(
    (data) => {
      const availableThemes = getThemesForBaseColor(data.baseColor);
      return availableThemes.some((t) => t.name === data.theme);
    },
    (data) => ({
      message: `Theme "${data.theme}" is not available for base color "${data.baseColor}"`,
      path: ["theme"],
    })
  )
  .refine(
    (data) => {
      const availableThemes = getThemesForBaseColor(data.baseColor);
      return availableThemes.some((t) => t.name === data.chartColor);
    },
    (data) => ({
      message: `Chart color "${data.chartColor}" is not available for base color "${data.baseColor}"`,
      path: ["chartColor"],
    })
  );

export type DesignSystemConfig = z.infer<typeof designSystemConfigSchema>;

export const DEFAULT_CONFIG: DesignSystemConfig = {
  base: "base",
  baseColor: "neutral",
  chartColor: "neutral",
  font: "inter",
  fontHeading: "inherit",
  iconLibrary: "lucide",
  item: "Item",
  menuAccent: "subtle",
  menuColor: "default",
  pointer: false,
  radius: "default",
  rtl: false,
  style: "nova",
  template: "next",
  theme: "neutral",
};

export type Preset = {
  name: string;
  title: string;
  description: string;
} & Omit<DesignSystemConfig, "pointer">;

export const PRESETS: Preset[] = [
  // Radix.
  {
    base: "radix",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Vega / Lucide / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-vega",
    radius: "default",
    rtl: false,
    style: "vega",
    theme: "neutral",
    title: "Vega (Radix)",
  },
  {
    base: "radix",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Nova / Lucide / Geist",
    font: "geist",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-nova",
    radius: "default",
    rtl: false,
    style: "nova",
    theme: "neutral",
    title: "Nova (Radix)",
  },
  {
    base: "radix",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Maia / Hugeicons / Figtree",
    font: "figtree",
    fontHeading: "inherit",
    iconLibrary: "hugeicons",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-maia",
    radius: "default",
    rtl: false,
    style: "maia",
    theme: "neutral",
    title: "Maia (Radix)",
  },
  {
    base: "radix",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Lyra / Tabler / JetBrains Mono",
    font: "jetbrains-mono",
    fontHeading: "inherit",
    iconLibrary: "phosphor",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-lyra",
    radius: "default",
    rtl: false,
    style: "lyra",
    theme: "neutral",
    title: "Lyra (Radix)",
  },
  // Base.
  {
    base: "base",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Vega / Lucide / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-vega",
    radius: "default",
    rtl: false,
    style: "vega",
    theme: "neutral",
    title: "Vega (Base)",
  },
  {
    base: "base",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Nova / Lucide / Geist",
    font: "geist",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-nova",
    radius: "default",
    rtl: false,
    style: "nova",
    theme: "neutral",
    title: "Nova (Base)",
  },
  {
    base: "base",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Maia / Hugeicons / Figtree",
    font: "figtree",
    fontHeading: "inherit",
    iconLibrary: "hugeicons",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-maia",
    radius: "default",
    rtl: false,
    style: "maia",
    theme: "neutral",
    title: "Maia (Base)",
  },
  {
    base: "base",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Lyra / Tabler / JetBrains Mono",
    font: "jetbrains-mono",
    fontHeading: "inherit",
    iconLibrary: "phosphor",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-lyra",
    radius: "default",
    rtl: false,
    style: "lyra",
    theme: "neutral",
    title: "Lyra (Base)",
  },
  {
    base: "radix",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Mira / Hugeicons / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "hugeicons",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-mira",
    radius: "default",
    rtl: false,
    style: "mira",
    theme: "neutral",
    title: "Mira (Radix)",
  },
  {
    base: "base",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Mira / Hugeicons / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "hugeicons",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-mira",
    radius: "default",
    rtl: false,
    style: "mira",
    theme: "neutral",
    title: "Mira (Base)",
  },
  // Luma.
  {
    base: "radix",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Luma / Lucide / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-luma",
    radius: "default",
    rtl: false,
    style: "luma",
    theme: "neutral",
    title: "Luma (Radix)",
  },
  {
    base: "base",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Luma / Lucide / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-luma",
    radius: "default",
    rtl: false,
    style: "luma",
    theme: "neutral",
    title: "Luma (Base)",
  },
  // Rhea.
  {
    base: "radix",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Rhea / Lucide / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-rhea",
    radius: "default",
    rtl: false,
    style: "rhea",
    theme: "neutral",
    title: "Rhea (Radix)",
  },
  {
    base: "base",
    baseColor: "neutral",
    chartColor: "neutral",
    description: "Rhea / Lucide / Inter",
    font: "inter",
    fontHeading: "inherit",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-rhea",
    radius: "default",
    rtl: false,
    style: "rhea",
    theme: "neutral",
    title: "Rhea (Base)",
  },
  // Sera.
  {
    base: "radix",
    baseColor: "taupe",
    chartColor: "taupe",
    description: "Sera / Lucide / Noto Sans + Playfair Display",
    font: "noto-sans",
    fontHeading: "playfair-display",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "radix-sera",
    radius: "default",
    rtl: false,
    style: "sera",
    theme: "taupe",
    title: "Sera (Radix)",
  },
  {
    base: "base",
    baseColor: "taupe",
    chartColor: "taupe",
    description: "Sera / Lucide / Noto Sans + Playfair Display",
    font: "noto-sans",
    fontHeading: "playfair-display",
    iconLibrary: "lucide",
    item: "Item",
    menuAccent: "subtle",
    menuColor: "default",
    name: "base-sera",
    radius: "default",
    rtl: false,
    style: "sera",
    theme: "taupe",
    title: "Sera (Base)",
  },
];

export function getThemesForBaseColor(baseColorName: string) {
  const baseColorNames = BASE_COLORS.map((bc) => bc.name);

  return THEMES.filter((theme) => {
    if (theme.name === baseColorName) {
      return true;
    }
    return !baseColorNames.includes(theme.name);
  });
}

export function getBase(name: BaseName) {
  return BASES.find((base) => base.name === name);
}

export function getStyle(name: StyleName) {
  return STYLES.find((style) => style.name === name);
}

export function getTheme(name: ThemeName) {
  return THEMES.find((theme) => theme.name === name);
}

export function getBaseColor(name: BaseColorName) {
  return BASE_COLORS.find((color) => color.name === name);
}

export function getIconLibrary(name: IconLibraryName) {
  return iconLibraries[name];
}

export function parseRegistryBaseParts(value: string | null) {
  if (value === null) {
    return { parts: undefined, success: true as const };
  }

  const aliases: Record<string, RegistryBasePart> = {
    font: "font",
    fonts: "font",
    theme: "theme",
  };
  const rawParts = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const invalid = rawParts.filter((part) => !aliases[part]);

  if (!rawParts.length || invalid.length) {
    return {
      error: `Invalid only value. Use one or more of: ${REGISTRY_BASE_PARTS.join(", ")}`,
      success: false as const,
    };
  }

  return {
    parts: Array.from(new Set(rawParts.map((part) => aliases[part]))),
    success: true as const,
  };
}

// Builds a registry:theme item from a design system config.
export function buildRegistryTheme(config: DesignSystemConfig) {
  const baseColor = getBaseColor(config.baseColor);
  const theme = getTheme(config.theme);

  if (!(baseColor && theme)) {
    throw new Error(
      `Base color "${config.baseColor}" or theme "${config.theme}" not found`
    );
  }

  // Merge base color and theme CSS vars.
  const lightVars: Record<string, string> = {
    ...(baseColor.cssVars?.light as Record<string, string>),
    ...(theme.cssVars?.light as Record<string, string>),
  };
  const darkVars: Record<string, string> = {
    ...(baseColor.cssVars?.dark as Record<string, string>),
    ...(theme.cssVars?.dark as Record<string, string>),
  };
  const themeVars: Record<string, string> = {};

  // Apply chart color override.
  const chartTheme = getTheme(config.chartColor);
  if (chartTheme) {
    const chartLight = chartTheme.cssVars?.light as Record<string, string>;
    const chartDark = chartTheme.cssVars?.dark as Record<string, string>;
    for (let i = 1; i <= 5; i++) {
      const key = `chart-${i}`;
      if (chartLight?.[key]) {
        lightVars[key] = chartLight[key];
      }
      if (chartDark?.[key]) {
        darkVars[key] = chartDark[key];
      }
    }
  }

  // Apply menu accent transformation.
  if (config.menuAccent === "bold") {
    lightVars.accent = lightVars.primary;
    lightVars["accent-foreground"] = lightVars["primary-foreground"];
    darkVars.accent = darkVars.primary;
    darkVars["accent-foreground"] = darkVars["primary-foreground"];
    // lightVars["sidebar-accent"] = lightVars.primary
    // lightVars["sidebar-accent-foreground"] = lightVars["primary-foreground"]
    // darkVars["sidebar-accent"] = darkVars.primary
    // darkVars["sidebar-accent-foreground"] = darkVars["primary-foreground"]
  }

  // Apply radius transformation.
  if (config.radius && config.radius !== "default") {
    const radius = RADII.find((r) => r.name === config.radius);
    if (radius && radius.value) {
      lightVars.radius = radius.value;
    }
  }

  return {
    cssVars: {
      dark: darkVars,
      light: lightVars,
      theme: Object.keys(themeVars).length > 0 ? themeVars : undefined,
    },
    name: `${config.baseColor}-${config.theme}`,
    type: "registry:theme" as const,
  };
}

export function buildThemeForPreset(config: DesignSystemConfig) {
  const registryTheme = buildRegistryTheme(config);
  const radius = RADII.find((r) => r.name === config.radius);
  const radiusValue =
    config.radius === "default"
      ? (registryTheme.cssVars?.light?.radius ?? DEFAULT_RADIUS_VALUE)
      : (radius?.value ?? registryTheme.cssVars?.light?.radius);

  return registryItemSchema.parse({
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    cssVars: {
      ...registryTheme.cssVars,
      light: {
        ...registryTheme.cssVars.light,
        ...(radiusValue && { radius: radiusValue }),
      },
    },
    name: registryTheme.name,
    type: "registry:theme",
  });
}

// Builds a registry:base item from a design system config.
export function buildRegistryBase(config: DesignSystemConfig) {
  const baseItem = getBase(config.base);
  const iconLibraryItem = getIconLibrary(config.iconLibrary);
  const normalizedFontHeading =
    config.fontHeading === config.font ? "inherit" : config.fontHeading;

  if (!(baseItem && iconLibraryItem)) {
    throw new Error(
      `Base "${config.base}" or icon library "${config.iconLibrary}" not found`
    );
  }

  const registryTheme = buildRegistryTheme(config);

  // Build dependencies.
  const dependencies = [
    `shadcn@${SHADCN_VERSION}`,
    "class-variance-authority",
    "tw-animate-css",
    ...(baseItem.dependencies ?? []),
    ...iconLibraryItem.packages,
  ];

  const registryDependencies = ["utils"];
  const themeVars = {
    ...(registryTheme.cssVars?.theme ?? {}),
    ...(normalizedFontHeading === "inherit"
      ? { "--font-heading": getInheritedHeadingFontValue(config.font) }
      : {}),
  };

  if (config.font) {
    registryDependencies.push(`font-${config.font}`);
  }

  if (normalizedFontHeading !== "inherit") {
    registryDependencies.push(`font-heading-${normalizedFontHeading}`);
  }

  return {
    config: {
      iconLibrary: iconLibraryItem.name,
      menuAccent: config.menuAccent,
      menuColor: config.menuColor,
      rtl: config.rtl,
      style: `${config.base}-${config.style}`,
      tailwind: {
        baseColor: config.baseColor,
      },
    },
    css: {
      '@import "shadcn/tailwind.css"': {},
      '@import "tw-animate-css"': {},
      "@layer base": {
        "*": { "@apply border-border outline-ring/50": {} },
        body: { "@apply bg-background text-foreground": {} },
        ...(config.pointer && {
          [POINTER_CURSOR_SELECTOR]: {
            cursor: "pointer",
          },
        }),
      },
    },
    cssVars: {
      ...registryTheme.cssVars,
      theme: Object.keys(themeVars).length > 0 ? themeVars : undefined,
    },
    dependencies,
    extends: "none",
    name: `${config.base}-${config.style}`,
    registryDependencies,
    type: "registry:base" as const,
    ...(config.rtl && {
      docs: `To learn how to set up the RTL provider and fonts for your app, see https://ui.shadcn.com/docs/rtl/${config.template === "next-monorepo" ? "next" : (config.template ?? "next")}`,
    }),
  };
}

export function buildPartialRegistryBase(
  config: DesignSystemConfig,
  parts: RegistryBasePart[]
) {
  const uniqueParts = Array.from(new Set(parts));
  const normalizedFontHeading =
    config.fontHeading === config.font ? "inherit" : config.fontHeading;
  const partialConfig: {
    menuColor?: DesignSystemConfig["menuColor"];
    menuAccent?: DesignSystemConfig["menuAccent"];
    tailwind?: {
      baseColor?: string;
    };
  } = {};
  const registryDependencies: string[] = [];
  const cssVars: NonNullable<RegistryItem["cssVars"]> = {};

  if (uniqueParts.includes("theme")) {
    const registryTheme = buildRegistryTheme(config);

    partialConfig.menuColor = config.menuColor;
    partialConfig.menuAccent = config.menuAccent;
    partialConfig.tailwind = {
      baseColor: config.baseColor,
    };

    if (registryTheme.cssVars.theme) {
      cssVars.theme = {
        ...(cssVars.theme ?? {}),
        ...registryTheme.cssVars.theme,
      };
    }
    cssVars.light = {
      ...(cssVars.light ?? {}),
      ...registryTheme.cssVars.light,
    };
    cssVars.dark = {
      ...(cssVars.dark ?? {}),
      ...registryTheme.cssVars.dark,
    };
  }

  if (uniqueParts.includes("font")) {
    registryDependencies.push(`font-${config.font}`);

    if (normalizedFontHeading === "inherit") {
      cssVars.theme = {
        ...(cssVars.theme ?? {}),
        "--font-heading": getInheritedHeadingFontValue(config.font),
      };
    } else {
      registryDependencies.push(`font-heading-${normalizedFontHeading}`);
    }
  }

  return {
    extends: "none",
    name: `${config.base}-${config.style}-${uniqueParts.join("-")}`,
    type: "registry:base" as const,
    ...(Object.keys(partialConfig).length > 0 && { config: partialConfig }),
    ...(registryDependencies.length > 0 && { registryDependencies }),
    ...(Object.keys(cssVars).length > 0 && { cssVars }),
  } satisfies RegistryItem;
}
