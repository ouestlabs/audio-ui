import {
  type ComponentCategorySeo,
  getComponentCategorySeo as getComponentCategorySeoUncached,
  getComponentIndexSeo as getComponentIndexSeoUncached,
} from "./registry";

/** The SEO copy of a category page, worked out once: the head and the page body both read it. */
const categorySeo = new Map<string, ComponentCategorySeo>();
let indexSeo: ComponentCategorySeo | undefined;

export function getComponentCategorySeo(category: string) {
  let seo = categorySeo.get(category);
  if (!seo) {
    seo = getComponentCategorySeoUncached(category);
    categorySeo.set(category, seo);
  }
  return seo;
}

export function getComponentIndexSeo() {
  indexSeo ??= getComponentIndexSeoUncached();
  return indexSeo;
}
