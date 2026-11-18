import { getIconLibraryFromStyle } from "@/lib/registry/core/icons";
import type { BaseName, IconLibraryName, StyleName } from "@/registry/config";

export const DEFAULT_DOCS_STYLE_NAME = "ui-sdk-nova";

/** A registry style is its base and its look: `ui-sdk-nova` is the `ui-sdk` base in `nova`, `base-nova` the `base` one. */
function splitStyleName(styleName: string) {
  const base = styleName.startsWith("ui-sdk-")
    ? "ui-sdk"
    : styleName.split("-")[0];
  return {
    base: base ?? "",
    style: styleName.slice(base ? base.length + 1 : 0),
  };
}

function parseRegistryStyleName(styleName: string) {
  const fallback = splitStyleName(DEFAULT_DOCS_STYLE_NAME);
  const parsed = splitStyleName(styleName);

  return {
    base: parsed.base || fallback.base,
    style: parsed.style || fallback.style,
  };
}

export function resolveRegistryStyleName(styleName?: string) {
  const { base, style } = parseRegistryStyleName(
    styleName ?? DEFAULT_DOCS_STYLE_NAME
  );

  return `${base}-${style}`;
}

export function getSelectedRegistryStyleName(
  base?: BaseName,
  style?: StyleName
) {
  const fallback = parseRegistryStyleName(DEFAULT_DOCS_STYLE_NAME);

  return `${base ?? fallback.base}-${style ?? fallback.style}`;
}

export function resolveRegistryIconLibrary(
  iconLibrary: IconLibraryName | undefined,
  styleName: string
) {
  return iconLibrary ?? getIconLibraryFromStyle(styleName);
}
