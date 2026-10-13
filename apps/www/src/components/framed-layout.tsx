"use client";

import { SidebarIcon, SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  CustomizerContext,
  type CustomizerContextValue,
  useCustomizer,
} from "@/app/(create)/components/components/components-context";
import { CustomizerPanel } from "@/app/(create)/components/components/customizer-panel";
import { useIsDesktopCustomizer } from "@/app/(create)/components/components/use-is-desktop-customizer";
import { Frame, FrameContent, FrameHeader } from "@/components/custom/frame";
import { CustomizerSkeleton } from "@/components/framed-skeleton";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComponentsLayoutState, useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

/** What the bar adds while the navigation is shut: shown from what is stored before the page is hydrated, from its state after. */
const CLOSED_BLOCK =
  "hidden lg:group-data-[nav=closed]/framed:block lg:[html[data-nav-closed]_&]:block";
const CLOSED_FLEX =
  "hidden lg:group-data-[nav=closed]/framed:flex lg:[html[data-nav-closed]_&]:flex";

/** Whether a key press is for a field: the shortcuts leave it alone. */
function isTyping(event: KeyboardEvent) {
  const { target } = event;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Calls `action` when `key` is pressed on its own, from anywhere on the page but a field. */
function useShortcut(key: string, action: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== key ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event)
      ) {
        return;
      }
      event.preventDefault();
      action();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [key, action]);
}

/**
 * The inset's place: an even margin all round, except where a sidebar already
 * leaves one, so both sides keep the same distance. Which sides is told by the
 * stylesheet (see `.inset-pane`), from what is stored, so it is right on the
 * first paint.
 */
function InsetPane({ children }: { children: React.ReactNode }) {
  return (
    <div className="inset-pane min-h-0 min-w-0 flex-1 p-2 pt-0 lg:pt-2">
      {children}
    </div>
  );
}

/** At the start of the bar: shows and hides the navigation sidebar. The P key does the same. */
function NavigationToggle() {
  const { open, toggleSidebar } = useSidebar();
  useShortcut("p", toggleSidebar);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-expanded={open}
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
      <TooltipContent className="flex items-center gap-2" side="bottom">
        {open ? "Hide" : "Show"} navigation <Kbd>P</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/** At the end of the bar: shows and hides the customizer. The C key does the same. */
function CustomizeToggle() {
  const { customizerOpen, toggleCustomizer } = useCustomizer();
  useShortcut("c", toggleCustomizer);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-expanded={customizerOpen}
            aria-label="Customize"
            className="text-site-muted-foreground"
            onClick={toggleCustomizer}
            size="icon"
            variant="outline"
          >
            <SlidersHorizontalIcon aria-hidden />
          </Button>
        }
      />
      <TooltipContent className="flex items-center gap-2" side="bottom">
        Customize <Kbd>C</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The framed layout of the docs and of the catalog: a navigation sidebar on
 * the left, the page in an inset frame (a bar, the page scrolling under it,
 * an optional footer) and the customizer in a sidebar on the right. Whether
 * each sidebar is open is remembered, and shared by the two views. Below `lg`
 * the sidebars give way: the navigation to the header's menu, the customizer
 * to a sheet.
 */
export function FramedLayout({
  closedEnd,
  closedStart,
  siteEnd,
  children,
  footer,
  nav,
  start,
}: {
  /** In the bar, from `lg`, while the navigation is shut: what its header held. */
  closedEnd?: React.ReactNode;
  closedStart?: React.ReactNode;
  /** In the bar, from `lg`, always: after the page's tools, set apart from them. */
  siteEnd?: React.ReactNode;
  children: React.ReactNode;
  /** Under the page, on the frame. */
  footer?: React.ReactNode;
  /** The navigation sidebar, shown from `lg`. */
  nav: React.ReactNode;
  /** In the bar, after the navigation's button. */
  start?: React.ReactNode;
}) {
  const mounted = useMounted();
  // The server and the first client render agree on open; the stored choice follows.
  const [layout, setLayout] = useComponentsLayoutState();
  const [config, setConfig] = useConfig();
  const navigationOpen = mounted ? layout.sidebarOpen : true;
  // Below `lg` the customizer is a sheet: it starts shut, whatever the sidebar's remembered state.
  const isDesktop = useIsDesktopCustomizer();
  const [sheetOpen, setSheetOpen] = useState(false);
  const desktopOpen = mounted ? config.customizerOpen : true;
  const customizerOpen = isDesktop ? desktopOpen : sheetOpen;

  // From here the state tells which sidebars are shut: the stored note the page started with is done.
  useEffect(() => {
    if (mounted) {
      document.documentElement.removeAttribute("data-customizer-closed");
      document.documentElement.removeAttribute("data-nav-closed");
    }
  }, [mounted]);

  // Once the stored choice is applied, wait two frames before letting the
  // sidebars animate: they would otherwise slide shut on load.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
  }, []);

  const setNavigationOpen = useCallback(
    (open: boolean) => setLayout((prev) => ({ ...prev, sidebarOpen: open })),
    [setLayout]
  );
  const setCustomizerOpen = useCallback(
    (open: boolean) =>
      isDesktop
        ? setConfig((prev) => ({ ...prev, customizerOpen: open }))
        : setSheetOpen(open),
    [isDesktop, setConfig]
  );
  const toggleCustomizer = useCallback(
    () =>
      isDesktop
        ? setConfig((prev) => ({
            ...prev,
            customizerOpen: !prev.customizerOpen,
          }))
        : setSheetOpen((open) => !open),
    [isDesktop, setConfig]
  );
  const customizer = useMemo<CustomizerContextValue>(
    () => ({ customizerOpen, setCustomizerOpen, toggleCustomizer }),
    [customizerOpen, setCustomizerOpen, toggleCustomizer]
  );

  return (
    <CustomizerContext value={customizer}>
      {settled ? null : (
        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: no animation until the stored layout is applied.
          dangerouslySetInnerHTML={{
            __html:
              "[data-framed-layout] * { transition-duration: 0s !important; animation-duration: 0s !important; }",
          }}
        />
      )}
      {/* The inset stays in the viewport: the page scrolls inside it, under the bar. */}
      <SidebarProvider
        className="group/framed bordered-sidebar h-[calc(100svh-var(--header-height))] min-h-0 flex-none items-stretch gap-0 px-0 [--sidebar-width:15rem] [--top-spacing:0] **:data-[slot=sidebar-gap]:transition-none **:data-[slot=sidebar-container]:transition-none [&_[data-state=expanded]_[data-slot=sidebar-inner]]:animate-in [&_[data-state=expanded]_[data-slot=sidebar-inner]]:fade-in-0 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:slide-in-from-left-4 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:duration-200 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:ease-[cubic-bezier(0.22,1,0.36,1)] [&_[data-state=expanded]_[data-slot=sidebar-inner]]:motion-reduce:animate-none"
        data-customizer={desktopOpen ? "open" : "closed"}
        data-framed-layout=""
        data-nav={navigationOpen ? "open" : "closed"}
        onOpenChange={setNavigationOpen}
        open={navigationOpen}
        suppressHydrationWarning
      >
        {/* Below lg the navigation is the header's menu. */}
        <div className="hidden lg:contents">{nav}</div>
        <InsetPane>
          <Frame className="h-full">
            <FrameHeader className="min-h-11 shrink-0 flex-row items-center gap-2 px-2 py-1.5">
              <NavigationToggle />
              <Separator className={CLOSED_BLOCK} orientation="vertical" />
              <div className={CLOSED_BLOCK}>{closedStart}</div>
              {start}
              <div className="ml-auto flex items-center gap-2">
                <div className="hidden items-center gap-2 lg:flex">
                  <div className={cn("items-center gap-2", CLOSED_FLEX)}>
                    {closedEnd}
                    <Separator orientation="vertical" />
                  </div>
                  {siteEnd}
                </div>
                <Separator className="hidden lg:block" orientation="vertical" />
                <CustomizeToggle />
              </div>
            </FrameHeader>
            <FrameContent className="flex min-h-0 flex-1 flex-col">
              <div className="scroll-fade-y no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
                {children}
              </div>
            </FrameContent>
            {footer}
          </Frame>
        </InsetPane>
        {/* The choices read the URL: their own boundary keeps the page around them rendered. */}
        <Suspense fallback={<CustomizerSkeleton />}>
          <CustomizerPanel variant="sidebar" />
        </Suspense>
      </SidebarProvider>
    </CustomizerContext>
  );
}
