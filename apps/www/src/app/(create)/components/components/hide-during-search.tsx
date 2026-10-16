"use client";

import { useQueryStates } from "nuqs";
import type { ReactNode } from "react";
import {
  hasActiveCatalogSearch,
  normalizeCatalogSearchQuery,
} from "@/lib/catalog-search-filter";
import { parseAsSearchStringClient } from "@/lib/nuqs";

/**
 * What describes a category (its title, its intro, its text) is hidden while
 * a search is active: the search looks in the whole catalog, so the results
 * are not the category's.
 */
export function HideDuringSearch({ children }: { children: ReactNode }) {
  const [{ search }] = useQueryStates({ search: parseAsSearchStringClient });
  return hasActiveCatalogSearch(normalizeCatalogSearchQuery(search || ""))
    ? null
    : children;
}
