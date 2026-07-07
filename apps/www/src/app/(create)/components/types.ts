import type { CategoryInfo } from "@/lib/registry";

export type { CatalogGridMode } from "@/hooks/use-config";
export type { CategoryInfo };
export type GridSize = 1 | 2;

export interface CatalogItem {
  categories: string[];
  description?: string;
  meta?: {
    className?: string;
    colSpan?: number;
    gridSize?: GridSize;
    order?: number;
  };
  name: string;
  primaryCategory?: string;
  // Pre-computed for fast search (optional for backwards compatibility)
  searchText?: string;
}

// Legacy type for backwards compatibility
export interface CategoryWithCount {
  category: string;
  count: number;
  description?: string;
}
