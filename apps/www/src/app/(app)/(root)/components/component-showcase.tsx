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
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";

// SSR-safe default — must match server render to avoid hydration mismatch
const DEFAULT_CUSTOMIZER_OPEN = true;

function ShowcaseHeader() {
  const { customizerOpen, toggleCustomizer } = useCustomizer();

  return (
    <div className="flex min-h-12 shrink-0 items-center justify-between p-2">
      <div aria-hidden="true" className="flex items-center gap-1.5 px-2">
        <span className="size-2.5 rounded-full bg-site-destructive" />
        <span className="size-2.5 rounded-full bg-site-warning" />
        <span className="size-2.5 rounded-full bg-site-success" />
      </div>
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
  const mounted = useMounted();
  const [config, setConfig] = useConfig();
  const customizerOpen = mounted
    ? (config.customizerOpen ?? DEFAULT_CUSTOMIZER_OPEN)
    : DEFAULT_CUSTOMIZER_OPEN;

  const customizerValue = React.useMemo(
    () => ({
      customizerOpen,
      setCustomizerOpen: (open: boolean) =>
        setConfig((prev) => ({ ...prev, customizerOpen: open })),
      toggleCustomizer: () =>
        setConfig((prev) => ({
          ...prev,
          customizerOpen: !prev.customizerOpen,
        })),
    }),
    [customizerOpen, setConfig]
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
