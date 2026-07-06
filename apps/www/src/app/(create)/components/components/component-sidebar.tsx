"use client";

import * as React from "react";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";

import { ComponentSidebarContent } from "./component-sidebar-content";
import { ComponentSidebarHeader } from "./component-sidebar-header";
import { useComponents } from "./components-provider";

export function ComponentSidebar() {
  const { toggleSidebar, isMobile } = useSidebar();
  const { sidebarCategoryFilter, sidebarMenuView } = useComponents();

  const internalView: "list" | "compact" =
    sidebarMenuView === "menu" ? "list" : "compact";

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggleSidebar]);

  if (isMobile) {
    return null;
  }

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))] border-site-border/80 border-r bg-site-background">
      <ComponentSidebarHeader />
      <SidebarContent className="p-0">
        <ComponentSidebarContent
          filter={sidebarCategoryFilter}
          view={internalView}
        />
      </SidebarContent>
    </Sidebar>
  );
}
