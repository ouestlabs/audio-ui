"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FrameContent, frameClassName } from "@/components/custom/frame";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useComponentsLayoutState, useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import type { ComponentCatalogItem } from "@/lib/registry";
import { cn } from "@/lib/utils";

import { ComponentHeader } from "./component-header";
import { ComponentSidebar } from "./component-sidebar";
import {
  ComponentsContext,
  type ComponentsContextValue,
  CustomizerContext,
  type CustomizerContextValue,
} from "./components-context";
import { CustomizerPanel } from "./customizer-panel";

// SSR-safe defaults — must match server render to avoid hydration mismatch
const DEFAULT_SIDEBAR_OPEN = true;
const DEFAULT_CUSTOMIZER_OPEN = true;

interface ComponentsProviderProps {
  catalogItems: ComponentCatalogItem[];
  categoryCounts: Record<string, number>;
  children: React.ReactNode;
  totalCount: number;
}

export function ComponentsProvider({
  children,
  totalCount,
  categoryCounts,
  catalogItems,
}: ComponentsProviderProps) {
  // Mount guard: use SSR defaults until after first client paint,
  // then switch to stored values from localStorage (via Jotai atoms).
  // This prevents hydration mismatch and flash of wrong layout.
  const mounted = useMounted();
  // Settled guard: after stored values are applied, wait one frame before
  // re-enabling CSS transitions. This prevents sidebar open/close animations
  // from playing during initial layout settlement.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    // Double rAF: first frame applies stored values to DOM,
    // second frame ensures paint is complete before enabling transitions.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSettled(true);
      });
    });
  }, []);

  // Single source of truth: Jotai atoms from use-config.ts
  const [layoutState, setLayoutState] = useComponentsLayoutState();
  const [config, setConfig] = useConfig();

  // Gate values: use SSR defaults until mounted, then use stored values.
  // This ensures server HTML and initial client render produce identical output.
  const sidebarOpen = mounted ? layoutState.sidebarOpen : DEFAULT_SIDEBAR_OPEN;
  const customizerOpen = mounted
    ? (config.customizerOpen ?? DEFAULT_CUSTOMIZER_OPEN)
    : DEFAULT_CUSTOMIZER_OPEN;

  // Stable callbacks that write directly to atoms
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setLayoutState((prev) => ({ ...prev, sidebarOpen: open }));
    },
    [setLayoutState]
  );

  const toggleCustomizer = useCallback(() => {
    setConfig((prev) => ({ ...prev, customizerOpen: !prev.customizerOpen }));
  }, [setConfig]);

  const handleSetCustomizerOpen = useCallback(
    (open: boolean) => {
      setConfig((prev) => ({ ...prev, customizerOpen: open }));
    },
    [setConfig]
  );

  // Memoize context values to prevent unnecessary re-renders
  const componentsValue = useMemo<ComponentsContextValue>(
    () => ({
      catalogItems,
      categoryCounts,
      totalCount,
    }),
    [totalCount, categoryCounts, catalogItems]
  );

  const customizerValue = useMemo<CustomizerContextValue>(
    () => ({
      customizerOpen,
      setCustomizerOpen: handleSetCustomizerOpen,
      toggleCustomizer,
    }),
    [customizerOpen, toggleCustomizer, handleSetCustomizerOpen]
  );

  return (
    <ComponentsContext.Provider value={componentsValue}>
      <CustomizerContext.Provider value={customizerValue}>
        <div
          className={mounted ? "opacity-100" : "opacity-0"}
          suppressHydrationWarning
        >
          {!settled && (
            <style
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Suppress CSS transitions until layout has settled with stored values. This prevents sidebars from animating open→closed on initial load.
              dangerouslySetInnerHTML={{
                __html:
                  "[data-components-layout] * { transition-duration: 0s !important; }",
              }}
            />
          )}
          <SidebarProvider
            className="bordered-sidebar min-h-0 flex-1 [--top-spacing:0] **:data-[sidebar=sidebar]:bg-transparent"
            data-components-layout=""
            onOpenChange={handleOpenChange}
            open={sidebarOpen}
            suppressHydrationWarning
          >
            <ComponentSidebar />
            {/* The inset: the content in a frame of its own, between the two sidebars. */}
            <SidebarInset
              className={cn(
                frameClassName,
                "m-2 mt-0 h-[calc(100svh-var(--header-height)-0.5rem)] min-h-0 flex-1 bg-site-muted/50 shadow-none"
              )}
            >
              <ComponentHeader />
              <FrameContent className="flex min-h-0 flex-1 flex-col">
                <div className="scroll-fade-y no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {children}
                </div>
              </FrameContent>
            </SidebarInset>
            <CustomizerPanel />
          </SidebarProvider>
        </div>
      </CustomizerContext.Provider>
    </ComponentsContext.Provider>
  );
}
