"use client";

import { Provider as JotaiProvider } from "jotai";
import dynamic from "next/dynamic";
import * as React from "react";
import { ComponentGrid } from "@/app/(create)/components/components/component-grid";
import {
  CustomizerContext,
  useCustomizer,
} from "@/app/(create)/components/components/components-context";
import { CustomizerSidebarHeader } from "@/app/(create)/components/components/customizer-sidebar-header";
import { CustomizerSidebarToggle } from "@/app/(create)/components/components/customizer-sidebar-toggle";
import type { CatalogItem } from "@/app/(create)/components/types";
import { DesignSystemProvider } from "@/app/(create)/customizer/design-system-provider";
import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { AudioDemoProvider } from "@/components/audio-demo-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Client-only: nuqs + jotai + theme pickers diverge from SSR; avoids hydration errors. */
const CustomizerSidebarContent = dynamic(
  () =>
    import(
      "@/app/(create)/components/components/customizer-sidebar-content"
    ).then((m) => m.CustomizerSidebarContent),
  {
    ssr: false,
    loading: () => <div aria-hidden className="flex-1" />,
  }
);

function ShowcaseCustomizerAside() {
  const isMobile = useIsMobile();
  const { customizerOpen } = useCustomizer();
  const anchorRef = React.useRef<HTMLDivElement>(null);

  if (isMobile) {
    return null;
  }

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col overflow-hidden border-site-border/80 border-l bg-site-background transition-[width,border-color] duration-200 ease-[cubic-bezier(0.77,0,0.175,1)]",
        !customizerOpen && "w-0 border-l-0"
      )}
      ref={anchorRef}
    >
      <CustomizerSidebarHeader />
      <CustomizerSidebarContent anchorRef={anchorRef} isMobile={isMobile} />
    </aside>
  );
}

export function ComponentShowcase({
  catalogItems,
}: {
  catalogItems: CatalogItem[];
}) {
  const [customizerOpen, setCustomizerOpen] = React.useState(true);
  const customizerValue = React.useMemo(
    () => ({
      customizerOpen,
      toggleCustomizer: () => setCustomizerOpen((open) => !open),
      setCustomizerOpen,
    }),
    [customizerOpen]
  );

  return (
    <section className="container-wrapper flex h-[calc(100dvh-var(--header-height))] flex-col pb-4 lg:pb-6">
      <React.Suspense fallback={<div className="flex-1" />}>
        <JotaiProvider>
          <LocksProvider>
            <DesignSystemProvider>
              <AudioDemoProvider>
                <CustomizerContext value={customizerValue}>
                  <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-site-border/80 bg-site-background shadow-xl">
                    <div className="relative min-h-0 flex-1">
                      <div className="no-scrollbar scroll-fade-y absolute inset-0 overflow-y-auto">
                        <ComponentGrid catalogItems={catalogItems} />
                      </div>
                      <div className="absolute top-3 right-3 z-10">
                        <CustomizerSidebarToggle />
                      </div>
                    </div>
                    <ShowcaseCustomizerAside />
                  </div>
                </CustomizerContext>
              </AudioDemoProvider>
            </DesignSystemProvider>
          </LocksProvider>
        </JotaiProvider>
      </React.Suspense>
    </section>
  );
}
