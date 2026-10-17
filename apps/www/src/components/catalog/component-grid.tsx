"use client";

import { useQueryStates } from "nuqs";
import { Suspense, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  filterCatalogBySearchQuery,
  hasActiveCatalogSearch,
  normalizeCatalogSearchQuery,
} from "@/lib/catalog-search-filter";
import { parseAsSearchStringClient } from "@/lib/nuqs";
import { ComponentCard } from "./component-card";
import { ComponentCardContainer } from "./component-card-container";
import { ComponentEmptyState } from "./component-empty-state";
import { useComponents } from "./components-context";
import type { CatalogItem } from "./types";

interface ComponentGridProps {
  catalogItems: CatalogItem[];
}

function ComponentCardSkeleton() {
  return (
    <ComponentCardContainer
      footer={
        <>
          <div className="flex flex-1 gap-1">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        </>
      }
    >
      <Spinner className="size-4 opacity-60" />
    </ComponentCardContainer>
  );
}

/**
 * Static-friendly catalog grid: `?search=` is filtered on the client so pages
 * stay CDN-cacheable without a dedicated iframe preview route.
 */
function ComponentGridContent({
  catalogItems,
}: {
  catalogItems: CatalogItem[];
}) {
  const [filters] = useQueryStates({
    search: parseAsSearchStringClient,
  });
  const searchQuery = normalizeCatalogSearchQuery(filters.search || "");
  const hasActiveSearch = hasActiveCatalogSearch(searchQuery);

  // A search looks in the whole catalog, whichever category page it is typed on.
  const { catalogItems: wholeCatalog } = useComponents();
  const filteredItems = useMemo(
    () =>
      filterCatalogBySearchQuery(
        hasActiveSearch ? (wholeCatalog as CatalogItem[]) : catalogItems,
        searchQuery
      ),
    [catalogItems, hasActiveSearch, searchQuery, wholeCatalog]
  );

  if (filteredItems.length === 0) {
    return (
      <div className="flex min-h-[calc(100svh-22rem)] w-full grow p-3 sm:px-8 sm:py-6 xl:px-10">
        <ComponentEmptyState
          className="grow"
          description={
            hasActiveSearch
              ? "Try another word, such as a device, a control or an effect."
              : "Nothing is listed here yet."
          }
          title={
            hasActiveSearch
              ? `No components for “${searchQuery}”`
              : "No components in this category"
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full p-3 sm:px-8 sm:py-6 xl:px-10">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(320px,calc((100%-24px)/2))),1fr))] items-stretch gap-4 pb-4 sm:gap-6">
        {filteredItems.map((item) => (
          <ComponentCard
            className={item.meta?.className}
            key={item.name}
            name={item.name}
          />
        ))}
      </div>
    </div>
  );
}

/** The cards shown while the catalog loads: six places, always the same. */
const SKELETON_SLOTS = Array.from({ length: 6 }, (_, slot) => slot);

export function ComponentGrid({ catalogItems }: ComponentGridProps) {
  return (
    <div className="flex flex-col">
      <Suspense
        fallback={
          <div className="w-full p-3 sm:px-8 sm:py-6 xl:px-10">
            <div className="grid items-stretch gap-4 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,max(320px,calc((100%-24px)/2))),1fr))]">
              {SKELETON_SLOTS.map((slot) => (
                <ComponentCardSkeleton key={slot} />
              ))}
            </div>
          </div>
        }
      >
        <ComponentGridContent catalogItems={catalogItems} />
      </Suspense>
    </div>
  );
}
