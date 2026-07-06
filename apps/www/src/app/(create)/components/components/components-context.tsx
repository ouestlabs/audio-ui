"use client";

import { createContext, use } from "react";
import type { ComponentCatalogItem } from "@/lib/registry";

export interface ComponentsContextValue {
  totalCount: number;
  categoryCounts: Record<string, number>;
  /** Full catalog list for search result counts in the header */
  catalogItems: ComponentCatalogItem[];
  sidebarCategoryFilter: string;
  setSidebarCategoryFilter: (filter: string) => void;
  sidebarMenuView: "menu" | "inline";
  setSidebarMenuView: (view: "menu" | "inline") => void;
}

export interface CustomizerContextValue {
  customizerOpen: boolean;
  toggleCustomizer: () => void;
  setCustomizerOpen: (open: boolean) => void;
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
    throw new Error("useCustomizer must be used within a ComponentsProvider");
  }
  return context;
}
