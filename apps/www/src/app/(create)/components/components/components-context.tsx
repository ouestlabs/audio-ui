"use client";

import { createContext, use } from "react";
import type { ComponentCatalogItem } from "@/lib/registry";

export interface ComponentsContextValue {
  /** Full catalog list for search result counts in the header */
  catalogItems: ComponentCatalogItem[];
  categoryCounts: Record<string, number>;
  totalCount: number;
}

export interface CustomizerContextValue {
  customizerOpen: boolean;
  setCustomizerOpen: (open: boolean) => void;
  toggleCustomizer: () => void;
}

export const ComponentsContext = createContext<ComponentsContextValue | null>(
  null
);

export const CustomizerContext = createContext<CustomizerContextValue | null>(
  null
);

export function useComponents() {
  const context = use(ComponentsContext);
  if (!context) {
    throw new Error("useComponents must be used within a ComponentsProvider");
  }
  return context;
}

export function useCustomizer() {
  const context = use(CustomizerContext);
  if (!context) {
    throw new Error("useCustomizer must be used within a FramedLayout");
  }
  return context;
}
