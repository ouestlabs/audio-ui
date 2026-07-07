"use client";

import { createContext, use } from "react";
import type { ComponentCatalogItem } from "@/lib/registry";

export interface ComponentsContextValue {
  /** Full catalog list for search result counts in the header */
  catalogItems: ComponentCatalogItem[];
  categoryCounts: Record<string, number>;
  setSidebarCategoryFilter: (filter: string) => void;
  setSidebarMenuView: (view: "menu" | "inline") => void;
  sidebarCategoryFilter: string;
  sidebarMenuView: "menu" | "inline";
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
    throw new Error("useCustomizer must be used within a ComponentsProvider");
  }
  return context;
}
