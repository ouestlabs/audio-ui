import { getCategoryInfo } from "@/lib/registry/core/registry";
import {
  type CanonicalComponentDocSlug,
  getDocsComponentCatalogIntro,
  isCanonicalComponentDoc,
} from "@/lib/seo/seo";
import { normalizeSlug } from "@/lib/utils";

import { DocsComponentCatalogCta } from "./component-catalog-cta";

interface DocsComponentCatalogSectionProps {
  componentSlug: string;
}

/**
 * Resolves the catalog count and intro for the docs catalog CTA.
 */
export function DocsComponentCatalogSection({
  componentSlug,
}: DocsComponentCatalogSectionProps) {
  const normalized = normalizeSlug(componentSlug);
  const info = getCategoryInfo(normalized);
  if (!info || info.count < 1) {
    return null;
  }

  if (!isCanonicalComponentDoc(normalized)) {
    return null;
  }

  const intro = getDocsComponentCatalogIntro(
    normalized as CanonicalComponentDocSlug,
    info.label,
    info.count
  );

  return (
    <DocsComponentCatalogCta
      catalogHref={`/components/${normalized}`}
      componentCount={info.count}
      intro={intro}
      label={info.label}
    />
  );
}
