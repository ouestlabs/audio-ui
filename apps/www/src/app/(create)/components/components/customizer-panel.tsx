"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
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

/** Room kept between the popup and the viewport's edges: the header above, a margin elsewhere. */
/** Always above the trigger: it never flips to its side, however tall it is. */
const FLOATING_AVOIDANCE = { align: "shift", side: "none" } as const;

const FLOATING_PADDING = { bottom: 12, left: 12, right: 12, top: 64 };

/**
 * A popover opened from the global trigger, which it sits above. It stays
 * where it is while the page behind keeps being used, so each choice shows as
 * it is made, and it takes the height the viewport leaves it from `md` up. Its
 * menus open leftwards, into the page, as it sits against the right edge.
 * Renders inside a `Popover.Root` whose trigger it is anchored to.
 */
function CustomizerPanelFloating({ animate }: { animate: boolean }) {
  const isDesktop = useIsDesktopCustomizer();
  const anchorRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align="end"
        className="isolate z-40"
        collisionAvoidance={FLOATING_AVOIDANCE}
        collisionPadding={FLOATING_PADDING}
        side="top"
        sideOffset={8}
      >
        <PopoverPrimitive.Popup
          aria-label="Customize"
          className={cn(
            "site-rounded-xl flex max-h-[min(50dvh,var(--available-height))] w-[calc(100vw-1.5rem)] origin-(--transform-origin) flex-col overflow-hidden bg-site-background shadow-xl outline-none ring-1 ring-site-foreground/10 sm:w-64 md:h-[calc(100dvh-8rem)] md:max-h-none [&_[data-slot=dropdown-menu-trigger]]:w-full",
            animate &&
              "data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-closed:animate-out data-open:animate-in data-closed:duration-100 data-open:duration-150 motion-reduce:animate-none"
          )}
          data-slot="customizer-popover"
          ref={anchorRef}
        >
          <PickerSideProvider value="left">
            <CustomizerSidebarHeader />
            <CustomizerSidebarContent
              anchorRef={anchorRef}
              isMobile={!isDesktop}
            />
          </PickerSideProvider>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
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
  variant = "sidebar",
}: {
  /** Whether the floating panel eases in; off when a key opened it. */
  animate?: boolean;
  variant?: CustomizerPanelVariant;
}) {
  const isDesktop = useIsDesktopCustomizer();

  if (variant === "floating") {
    return <CustomizerPanelFloating animate={animate} />;
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
