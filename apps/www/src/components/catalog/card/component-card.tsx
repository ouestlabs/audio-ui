"use client";

import { PreviewBar } from "@/components/preview/frame/preview-frame";
import {
  HostedPreview,
  usePreviewHost,
} from "@/components/preview/frame/preview-host";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { useConfigBase } from "@/hooks/use-config";
import { getPreviewHint } from "@/lib/docs/menu/preview-hint";
import { isBlock, isExpandable } from "@/lib/registry/catalog/is-block";
import { getRegistryItemMetadata } from "@/lib/registry/core/registry";
import { AudioSessionProvider } from "@/registry-audio/bases/base/hooks/use-audio-session";

import {
  ComponentCardContainer,
  ComponentName,
  ComponentRenderer,
} from "./component-card-container";
import { ComponentSourceSheetContent } from "./component-source-sheet-content";

export function ComponentCard({
  name,
  className,
  base: propBase,
}: {
  name: string;
  className?: string;
  base?: string;
}) {
  // Get the current base preference
  const configBase = useConfigBase();
  const hosted = usePreviewHost(isExpandable(name));
  const base = propBase || configBase || "base";

  // Get item from the base-specific metadata (lightweight, no React)
  const item = getRegistryItemMetadata(name, base);

  if (!item) {
    return null;
  }

  const hint = getPreviewHint(name, base);
  const isFullWidth = item.meta?.gridSize === 1;

  return (
    <AudioSessionProvider>
      <ComponentCardContainer
        block={isBlock(name)}
        className={className}
        footer={
          <PreviewBar
            actions={
              <Sheet>
                <SheetTrigger
                  render={<Button variant="outline">View code</Button>}
                />
                <ComponentSourceSheetContent base={base} name={name} />
              </Sheet>
            }
            badge={
              process.env.NODE_ENV === "development" ? (
                <ComponentName name={name} />
              ) : null
            }
            expand={hosted}
            hint={hint}
            name={name}
          />
        }
        isFullWidth={isFullWidth}
      >
        {isExpandable(name) ? (
          <HostedPreview host={hosted.host} open={hosted.open}>
            <ComponentRenderer base={base} name={name} />
          </HostedPreview>
        ) : (
          <ComponentRenderer base={base} name={name} />
        )}
      </ComponentCardContainer>
    </AudioSessionProvider>
  );
}
