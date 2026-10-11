"use client";

import { PreviewBar } from "@/components/preview-frame";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { useConfig } from "@/hooks/use-config";
import { isBlock, isExpandable } from "@/lib/is-block";
import { getPreviewHint } from "@/lib/preview-hint";
import { getRegistryItemMetadata } from "@/lib/registry";

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
  // Get the current base preference (base or radix)
  const [config] = useConfig();
  const base = propBase || config?.base || "radix";

  // Get item from the base-specific metadata (lightweight, no React)
  const item = getRegistryItemMetadata(name, base);

  if (!item) {
    return null;
  }

  const hint = getPreviewHint(name, base);
  const isFullWidth = item.meta?.gridSize === 1;

  return (
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
          description={item.description}
          expand={
            isExpandable(name) ? (
              <ComponentRenderer base={base} name={name} />
            ) : undefined
          }
          hint={hint}
          name={name}
        />
      }
      isFullWidth={isFullWidth}
    >
      <ComponentRenderer base={base} name={name} />
    </ComponentCardContainer>
  );
}
