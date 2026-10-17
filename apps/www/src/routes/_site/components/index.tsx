import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ComponentPreviewView } from "@/components/catalog/card/component-preview-view";
import { ComponentCategorySeoContent } from "@/components/catalog/category/component-category-seo-content";
import { JsonLd } from "@/components/site/json-ld";
import { GridSkeleton } from "@/components/site/layout/grid-skeleton";
import { siteConfig } from "@/lib/config";
import {
  getTotalComponentCount,
  searchCatalog,
} from "@/lib/registry/core/registry";
import { getComponentIndexSeo } from "@/lib/registry/core/registry-seo-cache";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo/seo";

const totalComponentCount = getTotalComponentCount();
const allCatalogItems = searchCatalog("");
const title = "Audio UI Components";

export const Route = createFileRoute("/_site/components/")({
  component: ComponentsPage,
  head: () =>
    buildPageMetadata({
      description: `Browse ${totalComponentCount}+ free audio/ui components for React and Tailwind CSS`,
      keywords: [
        "audio ui components",
        "react audio components",
        "shadcn audio components",
        "shadcn components",
        "shadcn ui components",
        "shadcn ui component",
        "open source shadcn component",
        "React components",
        "Tailwind components",
      ],
      path: "/components",
      title: `${title} - audio/ui`,
    }),
});

function ComponentsPage() {
  const indexSeo = getComponentIndexSeo();

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: siteConfig.name, path: "/" },
          { name: "Components", path: "/components" },
        ])}
      />
      <section>
        <div className="w-full px-6 pt-8 pb-6 sm:px-8 xl:px-10">
          <h1 className="mt-3 min-w-0 max-w-4xl font-bold text-balanc text-xl sm:text-3xl">
            Audio UI Components
          </h1>
          <p className="mt-4 text-pretty text-base text-site-muted-foreground leading-7">
            Browse {totalComponentCount}+ free open-source audio/ui components
            for React and Tailwind CSS. audio/ui helps you move from headless
            primitives to polished audio product UI, players, mixers, synths,
            and channel strips.
          </p>
        </div>
      </section>
      <Suspense fallback={<GridSkeleton count={allCatalogItems.length} />}>
        <ComponentPreviewView catalogItems={allCatalogItems} />
      </Suspense>
      <ComponentCategorySeoContent seo={indexSeo} />
    </>
  );
}
