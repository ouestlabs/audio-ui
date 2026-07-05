"use client";

import { Columns2Icon, Rows2Icon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type CatalogGridMode, useConfig } from "@/hooks/use-config";
import { cn } from "@/lib/utils";

interface ComponentHeaderGridToggleProps {
  className?: string;
}

export function ComponentHeaderGridToggle({
  className,
}: ComponentHeaderGridToggleProps) {
  const [config, setConfig] = useConfig();

  const value = config?.gridColumns ?? 2;

  const handleValueChange = (val: string) => {
    if (!val) return;

    const numVal = Number(val) as CatalogGridMode;
    setConfig({
      ...config,
      gridColumns: numVal,
    });
  };

  return (
    <Tabs
      className={cn("flex h-8 shrink-0 flex-row gap-0", className)}
      onValueChange={handleValueChange}
      value={String(value)}
    >
      <TabsList className="h-8 p-0.5">
        {/* Pattern listing: 1 (row) or 2 columns */}
        <TabsTrigger
          aria-label="1 column (row mode)"
          className="h-7 w-8 px-0"
          title="1 column (row mode)"
          value="1"
        >
          <Rows2Icon className="size-3.5" />
        </TabsTrigger>
        <TabsTrigger
          aria-label="2 columns"
          className="h-7 w-8 px-0"
          title="2 columns"
          value="2"
        >
          <Columns2Icon className="size-3.5" />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
