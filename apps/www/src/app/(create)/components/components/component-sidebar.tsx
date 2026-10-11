"use client";

import * as React from "react";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";

import { ComponentSidebarContent } from "./component-sidebar-content";

export function ComponentSidebar() {
  const { toggleSidebar, isMobile } = useSidebar();

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
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))] group-data-[side=left]:border-r-0 bg-transparent **:data-[slot=sidebar-inner]:bg-transparent">
      <SidebarContent className="p-0">
        <ComponentSidebarContent />
      </SidebarContent>
    </Sidebar>
  );
}
