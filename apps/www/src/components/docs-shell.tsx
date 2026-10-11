"use client";

import { SidebarIcon, SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import { useCallback, useEffect, useMemo } from "react";
import {
  CustomizerContext,
  type CustomizerContextValue,
} from "@/app/(create)/components/components/components-context";
import { CustomizerPanel } from "@/app/(create)/components/components/customizer-panel";
import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { Frame, FrameContent, FrameHeader } from "@/components/custom/frame";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

/** The inset's place: an even margin all round, except where the navigation sidebar already leaves one. */
function InsetPane({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 p-2 pt-0",
        state === "expanded" && "lg:pl-0"
      )}
    >
      {children}
    </div>
  );
}

/** At the start of the inset's bar: shows and hides the navigation sidebar. */
function NavigationToggle() {
  const { toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Toggle navigation"
            className="hidden text-site-muted-foreground lg:inline-flex"
            onClick={toggleSidebar}
            size="icon"
            variant="outline"
          >
            <SidebarIcon aria-hidden />
          </Button>
        }
      />
      <TooltipContent side="bottom">Toggle navigation</TooltipContent>
    </Tooltip>
  );
}

/**
 * The layout of the docs, framed: navigation in a sidebar on the left, the
 * page in an inset frame, and the customizer in a sidebar on the right. Below
 * `lg` the sidebars give way: the navigation to the header's menu, the
 * customizer to the floating panel.
 */
export function DocsShell({
  children,
  footer,
  nav,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  /** The navigation sidebar, shown from `lg`. */
  nav: React.ReactNode;
}) {
  const [config, setConfig] = useConfig();
  const mounted = useMounted();
  // The server and the first client render agree on open; the stored choice follows.
  const customizerOpen = mounted ? config.customizerOpen : true;

  const setCustomizerOpen = useCallback(
    (open: boolean) => setConfig((prev) => ({ ...prev, customizerOpen: open })),
    [setConfig]
  );
  const toggleCustomizer = useCallback(
    () =>
      setConfig((prev) => ({ ...prev, customizerOpen: !prev.customizerOpen })),
    [setConfig]
  );
  // The C key opens and closes it, from anywhere on the page but a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (
        event.key.toLowerCase() !== "c" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        typing
      ) {
        return;
      }
      event.preventDefault();
      toggleCustomizer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleCustomizer]);

  const value = useMemo<CustomizerContextValue>(
    () => ({ customizerOpen, setCustomizerOpen, toggleCustomizer }),
    [customizerOpen, setCustomizerOpen, toggleCustomizer]
  );

  return (
    <LocksProvider>
      <CustomizerContext value={value}>
        {/* The inset stays in the viewport: the page scrolls inside it, under the header. */}
        <SidebarProvider className="bordered-sidebar h-[calc(100svh-var(--header-height))] min-h-0 flex-none items-stretch gap-0 px-0 [--sidebar-width:15rem] [--top-spacing:0]">
          {/* Below lg the navigation is the header's menu. */}
          <div className="hidden lg:contents">{nav}</div>
          <InsetPane>
            <Frame className="h-full">
              {/* The bar of the inset: the customizer's button sits here, in the page, not over it. */}
              <FrameHeader className="min-h-11 shrink-0 flex-row items-center justify-between gap-2 px-2 py-1.5">
                <NavigationToggle />
                <Button
                  aria-expanded={customizerOpen}
                  aria-label="Customize"
                  onClick={toggleCustomizer}
                  size="sm"
                  variant="outline"
                >
                  <SlidersHorizontalIcon aria-hidden weight="bold" />
                  <span className="hidden sm:inline">Customize</span>
                  <Kbd className="hidden sm:inline-flex">C</Kbd>
                </Button>
              </FrameHeader>
              {/* The panel: the page, scrolling under the header. */}
              <FrameContent
                className="scroll-fade-y no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto"
                data-docs-scroll=""
              >
                <div className="flex-1 px-4 sm:px-8">{children}</div>
                {footer}
              </FrameContent>
            </Frame>
          </InsetPane>
          <CustomizerPanel variant="sidebar" />
        </SidebarProvider>
      </CustomizerContext>
    </LocksProvider>
  );
}
