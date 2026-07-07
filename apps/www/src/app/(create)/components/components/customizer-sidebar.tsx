"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { useCustomizer } from "./components-context";
import { CustomizerSidebarHeader } from "./customizer-sidebar-header";

/** Client-only: nuqs + jotai + theme pickers diverge from SSR; avoids hydration errors. */
const CustomizerSidebarContent = dynamic(
  () =>
    import("./customizer-sidebar-content").then(
      (m) => m.CustomizerSidebarContent
    ),
  {
    loading: () => (
      <div aria-hidden className="max-h-[calc(100svh-240px)] flex-1" />
    ),
    ssr: false,
  }
);

export function CustomizerSidebar() {
  const { customizerOpen } = useCustomizer();
  const isMobile = useIsMobile();
  const anchorRef = React.useRef<HTMLDivElement | null>(null);

  if (isMobile) {
    return null;
  }

  return (
    <aside
      className={cn(
        "sticky top-(--header-height) hidden h-[calc(100svh-var(--header-height))] w-64 shrink-0 flex-col overflow-hidden border-site-border/80 border-l bg-site-background transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:flex",
        !customizerOpen && "w-0 border-l-0"
      )}
      ref={anchorRef}
    >
      <div className="flex h-full w-64 flex-col">
        <CustomizerSidebarHeader />
        <CustomizerSidebarContent anchorRef={anchorRef} isMobile={isMobile} />
      </div>
    </aside>
  );
}
