/**
 * What the customizer changes on a page: `all` where the registry draws (its
 * previews and sources, the home's editor, the catalog), `elements` where the
 * custom elements alone do, `icons` on the icons' page, where it holds the icon
 * picked with its weight and its size, `none` where nothing on the page
 * follows it.
 */
export type CustomizerScope = "all" | "elements" | "icons" | "none";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** What the customizer changes on a page whose content is fixed, such as the home or the catalog. */
    customizer?: CustomizerScope;
  }
}

/** A preview or a source of the registry: it follows every choice, the icon library in its code included. */
const REGISTRY_TAG = /<Component(?:Preview|Source)\b/;
const ELEMENTS_TAG = /<(?:Elements|React)Preview\b/;

/** What the customizer changes on a docs page, from its MDX. */
export function pageScope(mdx: string): CustomizerScope {
  if (REGISTRY_TAG.test(mdx)) {
    return "all";
  }
  return ELEMENTS_TAG.test(mdx) ? "elements" : "none";
}

/** The choices that change the custom elements' examples: their accent and radius. The others are the registry's own. */
export const ELEMENT_CHOICES: ReadonlySet<string> = new Set([
  "radius",
  "theme",
]);
