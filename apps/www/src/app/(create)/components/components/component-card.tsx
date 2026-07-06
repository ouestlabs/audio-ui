"use client";

import { CopyRegistry } from "@/components/copy-registry";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { useConfig } from "@/hooks/use-config";
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

  const isFullWidth = item.meta?.gridSize === 1;

  return (
    <ComponentCardContainer
      className={className}
      footer={
        <>
          <p className="flex flex-1 items-center gap-1.5 truncate text-site-muted-foreground text-xs">
            <span className="truncate">{item.description || name}</span>
          </p>
          <div className="flex items-center gap-1.5">
            {process.env.NODE_ENV === "development" && (
              <ComponentName name={name} />
            )}
            <CopyRegistry value={`@audio/${name}`} />
            <Sheet>
              <SheetTrigger
                render={<Button variant="outline">View code</Button>}
              />
              <ComponentSourceSheetContent base={base} name={name} />
            </Sheet>
          </div>
        </>
      }
      isFullWidth={isFullWidth}
    >
      <ComponentRenderer base={base} name={name} />
    </ComponentCardContainer>
  );
}
