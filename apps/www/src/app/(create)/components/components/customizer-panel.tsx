"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import { Frame, FrameContent } from "@/components/custom/frame";
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
    loading: () => <div aria-hidden className="flex-1" />,
    ssr: false,
  }
);

type CustomizerPanelVariant = "sidebar" | "frame";

/** Full-height bordered aside for the /components layout. */
function CustomizerPanelSidebar() {
  const { customizerOpen } = useCustomizer();
  const anchorRef = React.useRef<HTMLDivElement | null>(null);

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
        <CustomizerSidebarContent anchorRef={anchorRef} isMobile={false} />
      </div>
    </aside>
  );
}

/** Frame-styled aside for embedded showcases (e.g. the home page). */
function CustomizerPanelFrame() {
  const { customizerOpen } = useCustomizer();
  const anchorRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        customizerOpen ? "w-64" : "w-0"
      )}
      ref={anchorRef}
    >
      <Frame className="flex h-full w-64 flex-col">
        <CustomizerSidebarHeader className="border-b-0" />
        <FrameContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <CustomizerSidebarContent anchorRef={anchorRef} isMobile={false} />
        </FrameContent>
      </Frame>
    </div>
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
export function CustomizerPanel({
  variant = "sidebar",
}: {
  variant?: CustomizerPanelVariant;
}) {
  const isDesktop = useIsDesktopCustomizer();

  if (!isDesktop) {
    return <CustomizerPanelSheet />;
  }

  return variant === "frame" ? (
    <CustomizerPanelFrame />
  ) : (
    <CustomizerPanelSidebar />
  );
}
