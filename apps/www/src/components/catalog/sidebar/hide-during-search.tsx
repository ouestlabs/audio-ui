"use client";

import { useQueryStates } from "nuqs";
import type { ReactNode } from "react";
import { parseAsSearchStringClient } from "@/lib/nuqs";
import {
  filterCatalogBySearchQuery,
  hasActiveCatalogSearch,
  normalizeCatalogSearchQuery,
} from "@/lib/registry/catalog/catalog-search-filter";

import { useComponents } from "../components-context";

interface SearchAwareProps {
  children: ReactNode;
  /** What stands in for the children while a search is active. Nothing by default. */
  results?: boolean;
}

/**
 * What describes a category (its title, its intro, its text) gives way while
 * a search is active, since the search looks in the whole catalog and the
 * results are not the category's. With `results`, a header says what was
 * searched and how many components match.
 */
export function HideDuringSearch({ children, results }: SearchAwareProps) {
  const [{ search }] = useQueryStates({ search: parseAsSearchStringClient });
  const { catalogItems } = useComponents();
  const query = normalizeCatalogSearchQuery(search || "");
  if (!hasActiveCatalogSearch(query)) {
    return children;
  }
  if (!results) {
    return null;
  }
  const count = filterCatalogBySearchQuery(catalogItems, query).length;
  return (
    <section>
      <div className="w-full px-6 pt-8 pb-6 sm:px-8 xl:px-10">
        <h1 className="mt-3 min-w-0 font-bold text-balance text-xl sm:text-3xl">
          Results for “{query}”
        </h1>
        <p className="mt-4 text-pretty text-base text-site-muted-foreground leading-7">
          {count === 1 ? "1 component" : `${count} components`} across the whole
          catalog.
        </p>
      </div>
    </section>
  );
}
