import type { RegistryItem } from "shadcn/schema";

import { FONT_DEFINITIONS, type FontDefinition } from "@/lib/font-definitions";

function createFontItem(definition: FontDefinition, role: "body" | "heading") {
  return {
    font: {
      family: definition.family,
      provider: definition.provider,
      variable:
        role === "body" ? definition.registryVariable : "--font-heading",
      ...(definition.weight ? { weight: [...definition.weight] } : {}),
      dependency: definition.dependency,
      import: definition.import,
      subsets: [...definition.subsets],
    },
    name:
      role === "body"
        ? `font-${definition.name}`
        : `font-heading-${definition.name}`,
    title: role === "body" ? definition.title : `${definition.title} (Heading)`,
    type: "registry:font",
  } satisfies RegistryItem;
}

export const bodyFonts = FONT_DEFINITIONS.map((definition) =>
  createFontItem(definition, "body")
) satisfies RegistryItem[];

export const headingFonts = FONT_DEFINITIONS.map((definition) =>
  createFontItem(definition, "heading")
) satisfies RegistryItem[];

export const fonts = [...bodyFonts, ...headingFonts] satisfies RegistryItem[];
