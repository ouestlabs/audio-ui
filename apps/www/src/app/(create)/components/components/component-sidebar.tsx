"use client";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";

import { ComponentSidebarContent } from "./component-sidebar-content";

export function ComponentSidebar({ header }: { header?: React.ReactNode }) {
  const { isMobile } = useSidebar();

  if (isMobile) {
    return null;
  }

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))] group-data-[side=left]:border-r-0 bg-transparent **:data-[slot=sidebar-inner]:bg-transparent">
      {header}
      <SidebarContent className="p-0">
        <ComponentSidebarContent />
      </SidebarContent>
    </Sidebar>
  );
}
