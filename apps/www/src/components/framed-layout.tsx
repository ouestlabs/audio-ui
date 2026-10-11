"use client";

import { SidebarIcon, SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CustomizerContext,
  type CustomizerContextValue,
  useCustomizer,
} from "@/app/(create)/components/components/components-context";
import { CustomizerPanel } from "@/app/(create)/components/components/customizer-panel";
import { useIsDesktopCustomizer } from "@/app/(create)/components/components/use-is-desktop-customizer";
import { Frame, FrameContent, FrameHeader } from "@/components/custom/frame";
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

/** The inset's place: an even margin all round, except where the navigation sidebar already leaves one. */
function InsetPane({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 p-2 pt-0 lg:pt-2",
        state === "expanded" && "lg:pl-0"
      )}
    >
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
  actions,
  closedEnd,
  closedStart,
  siteEnd,
  children,
  footer,
  nav,
  start,
}: {
  /** In the bar, before the customizer's button. */
  actions?: React.ReactNode;
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
        className="bordered-sidebar h-[calc(100svh-var(--header-height))] min-h-0 flex-none items-stretch gap-0 px-0 [--sidebar-width:15rem] [--top-spacing:0] **:data-[slot=sidebar-gap]:transition-none **:data-[slot=sidebar-container]:transition-none [&_[data-state=expanded]_[data-slot=sidebar-inner]]:animate-in [&_[data-state=expanded]_[data-slot=sidebar-inner]]:fade-in-0 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:slide-in-from-left-4 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:duration-200 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:ease-[cubic-bezier(0.22,1,0.36,1)] [&_[data-state=expanded]_[data-slot=sidebar-inner]]:motion-reduce:animate-none"
        data-framed-layout=""
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
              {navigationOpen ? null : (
                <>
                  <Separator
                    className="hidden lg:block"
                    orientation="vertical"
                  />
                  <div className="hidden lg:block">{closedStart}</div>
                </>
              )}
              {start}
              <div className="ml-auto flex items-center gap-2">
                {actions}
                {actions ? (
                  <Separator
                    className="hidden lg:block"
                    orientation="vertical"
                  />
                ) : null}
                <div className="hidden items-center gap-2 lg:flex">
                  {navigationOpen ? null : (
                    <>
                      {closedEnd}
                      <Separator orientation="vertical" />
                    </>
                  )}
                  {siteEnd}
                </div>
                <Separator
                  className={actions ? undefined : "hidden lg:block"}
                  orientation="vertical"
                />
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
        <CustomizerPanel variant="sidebar" />
      </SidebarProvider>
    </CustomizerContext>
  );
}
