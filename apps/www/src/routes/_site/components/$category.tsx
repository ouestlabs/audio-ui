import { createFileRoute, notFound } from "@tanstack/react-router";
import { Suspense } from "react";
import { ComponentCategoryPager } from "@/components/catalog/component-category-pager";
import {
  ComponentCategoryHeroIntro,
  ComponentCategorySeoContent,
} from "@/components/catalog/component-category-seo-content";
import { ComponentDocsLink } from "@/components/catalog/component-docs-link";
import { ComponentPreviewView } from "@/components/catalog/component-preview-view";
import { HideDuringSearch } from "@/components/catalog/hide-during-search";
import { GridSkeleton } from "@/components/grid-skeleton";
import { JsonLd } from "@/components/json-ld";
import { siteConfig } from "@/lib/config";
import { getCategoryInfo, getComponentsByCategory } from "@/lib/registry";
import { getComponentCategorySeo } from "@/lib/registry-seo-cache";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { normalizeSlug } from "@/lib/utils";
import { categories } from "@/registry-audio/bases/categories";

export const Route = createFileRoute("/_site/components/$category")({
  beforeLoad: ({ params }) => {
    if (!getCategoryInfo(normalizeSlug(params.category))) {
      throw notFound();
    }
  },
  component: CategoryComponentsPage,
  head: ({ params }) => {
    const normalized = normalizeSlug(params.category);
    const categoryLabel = getCategoryInfo(normalized)?.label ?? params.category;
    const seo = getComponentCategorySeo(normalized);

    return buildPageMetadata({
      description: seo.description,
      keywords: [
        seo.title,
        `shadcn ${categoryLabel.toLowerCase()}`,
        `shadcn ${categoryLabel.toLowerCase()} components`,
        `${categoryLabel} React examples`,
        "open source shadcn components",
        ...seo.keywords,
      ],
      path: `/components/${normalized}`,
      title: seo.title,
      titleSuffix: siteConfig.metadata.titleSuffixes.componentCategory,
    });
  },
});

function CategoryComponentsPage() {
  const normalized = normalizeSlug(Route.useParams().category);
  const seo = getComponentCategorySeo(normalized);
  const catalogItems = getComponentsByCategory(normalized);
  const faqJsonLd = seo.content?.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: seo.content.faqs.map((faq) => ({
          "@type": "Question",
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
          name: faq.question,
        })),
      }
    : null;
  const header = (
    <section>
      <div className="w-full px-6 pt-8 pb-6 sm:px-8 xl:px-10">
        <div className="flex w-full flex-wrap items-end justify-between gap-3">
          <h1 className="mt-3 min-w-0 flex-1 font-bold text-balanc text-xl sm:text-3xl">
            {seo.title}
          </h1>
          <ComponentDocsLink
            slug={
              categories.find((item) => item.name === normalized)?.docs ??
              normalized
            }
          />
        </div>
        {seo.intro ? <ComponentCategoryHeroIntro intro={seo.intro} /> : null}
      </div>
    </section>
  );
  const footer = (
    <>
      <ComponentCategorySeoContent seo={seo} />
      <ComponentCategoryPager currentCategory={normalized} />
    </>
  );
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: siteConfig.name, path: "/" },
          { name: "Components", path: "/components" },
          { name: seo.title, path: `/components/${normalized}` },
        ])}
      />
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}
      <Suspense fallback={header}>
        <HideDuringSearch results>{header}</HideDuringSearch>
      </Suspense>
      <Suspense fallback={<GridSkeleton count={4} />}>
        <ComponentPreviewView catalogItems={catalogItems} />
      </Suspense>
      <Suspense fallback={footer}>
        <HideDuringSearch>{footer}</HideDuringSearch>
      </Suspense>
    </>
  );
}
