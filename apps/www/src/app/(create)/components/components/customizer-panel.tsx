"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import { PickerSideProvider } from "@/app/(create)/customizer/picker";
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

type CustomizerPanelVariant = "sidebar" | "frame" | "floating";

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

/**
 * Floats over the page's corner, above the global trigger, so the page stays
 * where it is and shows each change as it is made. Its menus open leftwards,
 * into the page, since it sits against the right edge.
 */
function CustomizerPanelFloating({
  animate,
  className,
}: {
  animate: boolean;
  className?: string;
}) {
  const { customizerOpen } = useCustomizer();
  const isDesktop = useIsDesktopCustomizer();
  const anchorRef = React.useRef<HTMLDivElement | null>(null);

  // Focus moves into the panel as it opens, so the keyboard carries on there.
  React.useEffect(() => {
    if (customizerOpen) {
      anchorRef.current?.focus({ preventScroll: true });
    }
  }, [customizerOpen]);

  if (!customizerOpen) {
    return null;
  }

  return (
    <section
      aria-label="Customize"
      className={cn(
        "site-rounded-xl fixed inset-x-3 z-40 flex max-h-[min(50dvh,36rem)] origin-bottom-right flex-col overflow-hidden bg-site-background shadow-xl outline-none ring-1 ring-site-foreground/10 sm:inset-x-auto sm:right-4 sm:w-64 md:top-[calc(var(--header-height)+0.5rem)] md:right-3 md:bottom-16 md:max-h-none [&_[data-slot=dropdown-menu-trigger]]:w-full",
        animate &&
          "fade-in-0 zoom-in-95 animate-in duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none",
        className
      )}
      ref={anchorRef}
      tabIndex={-1}
    >
      <PickerSideProvider value="left">
        <CustomizerSidebarHeader />
        <CustomizerSidebarContent anchorRef={anchorRef} isMobile={!isDesktop} />
      </PickerSideProvider>
    </section>
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
  animate = true,
  className,
  variant = "sidebar",
}: {
  /** Whether the floating panel eases in; off when a key opened it. */
  animate?: boolean;
  /** For the floating panel: where it sits. */
  className?: string;
  variant?: CustomizerPanelVariant;
}) {
  const isDesktop = useIsDesktopCustomizer();

  if (variant === "floating") {
    return <CustomizerPanelFloating animate={animate} className={className} />;
  }

  if (!isDesktop) {
    return <CustomizerPanelSheet />;
  }

  return variant === "frame" ? (
    <CustomizerPanelFrame />
  ) : (
    <CustomizerPanelSidebar />
  );
}
