"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { ComponentGrid } from "@/app/(create)/components/components/component-grid";
import {
  CustomizerContext,
  useCustomizer,
} from "@/app/(create)/components/components/components-context";
import { CustomizerPanel } from "@/app/(create)/components/components/customizer-panel";
import type { CatalogItem } from "@/app/(create)/components/types";
import { DesignSystemProvider } from "@/app/(create)/customizer/design-system-provider";
import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { AudioDemoProvider } from "@/components/audio-demo-provider";
import { Frame, FrameContent } from "@/components/custom/frame";
import { Button } from "@/components/ui/button";

function ShowcaseHeader() {
  const { customizerOpen, toggleCustomizer } = useCustomizer();

  return (
    <div className="flex min-h-12 shrink-0 items-center justify-between p-2">
      <Button className="text-site-muted-foreground" disabled variant="ghost">
        Components
      </Button>
      {!customizerOpen && (
        <Button onClick={toggleCustomizer} variant="outline">
          <SlidersHorizontalIcon className="size-4" weight="duotone" />
          Customize
        </Button>
      )}
    </div>
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
      setCustomizerOpen,
      toggleCustomizer: () => setCustomizerOpen((open) => !open),
    }),
    [customizerOpen]
  );

  return (
    <section className="container-wrapper flex h-[calc(100dvh-var(--header-height))] flex-col pb-4 lg:pb-6">
      <React.Suspense fallback={<div className="flex-1" />}>
        <LocksProvider>
          <DesignSystemProvider>
            <AudioDemoProvider>
              <CustomizerContext value={customizerValue}>
                <div className="flex min-h-0 flex-1 gap-2">
                  <Frame className="flex min-h-0 flex-1 flex-col">
                    <ShowcaseHeader />
                    <FrameContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                      <div className="no-scrollbar scroll-fade-y min-h-0 flex-1 overflow-y-auto">
                        <ComponentGrid catalogItems={catalogItems} />
                      </div>
                    </FrameContent>
                  </Frame>
                  <CustomizerPanel variant="frame" />
                </div>
              </CustomizerContext>
            </AudioDemoProvider>
          </DesignSystemProvider>
        </LocksProvider>
      </React.Suspense>
    </section>
  );
}
