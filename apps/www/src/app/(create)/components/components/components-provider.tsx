"use client";

import { useMemo } from "react";
import { FramedLayout } from "@/components/framed-layout";
import type { ComponentCatalogItem } from "@/lib/registry";

import { ComponentHeaderGridToggle } from "./component-header-grid-toggle";
import { ComponentHeaderMobileDrawer } from "./component-header-mobile-drawer";
import { ComponentHeaderSearch } from "./component-header-search";
import { ComponentSidebar } from "./component-sidebar";
import {
  ComponentsContext,
  type ComponentsContextValue,
} from "./components-context";

interface ComponentsProviderProps {
  catalogItems: ComponentCatalogItem[];
  categoryCounts: Record<string, number>;
  children: React.ReactNode;
  /** In the bar, while the navigation is shut. */
  closedEnd?: React.ReactNode;
  closedStart?: React.ReactNode;
  /** At the top of the navigation sidebar. */
  header?: React.ReactNode;
  /** In the bar, from `lg`, always. */
  siteEnd?: React.ReactNode;
  totalCount: number;
}

export function ComponentsProvider({
  children,
  closedEnd,
  closedStart,
  header,
  siteEnd,
  totalCount,
  categoryCounts,
  catalogItems,
}: ComponentsProviderProps) {
  const value = useMemo<ComponentsContextValue>(
    () => ({ catalogItems, categoryCounts, totalCount }),
    [totalCount, categoryCounts, catalogItems]
  );

  return (
    <ComponentsContext.Provider value={value}>
      <FramedLayout
        actions={<ComponentHeaderGridToggle />}
        closedEnd={closedEnd}
        closedStart={closedStart}
        nav={<ComponentSidebar header={header} />}
        siteEnd={siteEnd}
        start={
          <>
            <ComponentHeaderMobileDrawer />
            <ComponentHeaderSearch />
          </>
        }
      >
        {children}
      </FramedLayout>
    </ComponentsContext.Provider>
  );
}
