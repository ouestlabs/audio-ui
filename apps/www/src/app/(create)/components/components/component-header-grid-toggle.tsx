"use client";

import { ColumnsIcon, RowsIcon } from "@phosphor-icons/react/ssr";
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
    if (!val) {
      return;
    }

    const numVal = Number(val) as CatalogGridMode;
    setConfig({
      ...config,
      gridColumns: numVal,
    });
  };

  return (
    <Tabs
      className={cn("shrink-0", className)}
      onValueChange={handleValueChange}
      value={String(value)}
    >
      <TabsList>
        <TabsTrigger
          aria-label="1 column (row mode)"
          title="1 column (row mode)"
          value="1"
        >
          <RowsIcon weight="duotone" />
        </TabsTrigger>
        <TabsTrigger aria-label="2 columns" title="2 columns" value="2">
          <ColumnsIcon weight="duotone" />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
