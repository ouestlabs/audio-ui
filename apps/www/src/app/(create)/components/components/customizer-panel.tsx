"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import { CustomizerChoicesSkeleton } from "@/components/framed-skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCustomizer } from "./components-context";
import { CustomizerSidebarHeader } from "./customizer-sidebar-header";
import { useIsDesktopCustomizer } from "./use-is-desktop-customizer";

/** Client-only: nuqs + jotai + theme pickers diverge from SSR; avoids hydration errors. */
const CustomizerSidebarContent = dynamic(
  () =>
    import("./customizer-sidebar-content").then(
      (m) => m.CustomizerSidebarContent
    ),
  {
    loading: () => <CustomizerChoicesSkeleton />,
    ssr: false,
  }
);

/** Full-height bordered aside for the /components layout. */
function CustomizerPanelSidebar() {
  const { customizerOpen } = useCustomizer();
  const anchorRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <aside
      className={cn(
        "customizer-aside sticky top-(--header-height) hidden h-[calc(100svh-var(--header-height))] w-64 shrink-0 flex-col overflow-hidden lg:flex",
        !customizerOpen && "w-0"
      )}
      ref={anchorRef}
    >
      {/* The width changes at once, so the page is laid out once; what is shown eases in. */}
      <div
        className={cn(
          "flex h-full w-64 flex-col",
          customizerOpen &&
            "fade-in-0 slide-in-from-right-4 animate-in duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
        )}
      >
        <CustomizerSidebarContent anchorRef={anchorRef} isMobile={false} />
      </div>
    </aside>
  );
}

/** Below `lg`: the customizer rides in a right-side sheet. */
function CustomizerPanelSheet() {
  const { customizerOpen, setCustomizerOpen } = useCustomizer();
  const anchorRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <Sheet onOpenChange={setCustomizerOpen} open={customizerOpen}>
      <SheetContent
        className="gap-0 w-full!"
        ref={anchorRef}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Customize</SheetTitle>
        <SheetDescription className="sr-only">
          Adjust the style, colors, fonts, and other design system options.
        </SheetDescription>
        <CustomizerSidebarHeader />
        <CustomizerSidebarContent anchorRef={anchorRef} isMobile={false} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Single entry point for the customizer surface. Renders the desktop aside
 * (`sidebar` or `frame` styling) at `lg+` and the mobile sheet below, both
 * driven by the surrounding `CustomizerContext`.
 */
export function CustomizerPanel() {
  const isDesktop = useIsDesktopCustomizer();

  if (!isDesktop) {
    return <CustomizerPanelSheet />;
  }

  return <CustomizerPanelSidebar />;
}
