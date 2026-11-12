"use client";

import { useCallback } from "react";
import { Tabs } from "@/components/ui/tabs";
import { useFramework } from "@/hooks/use-framework";
import { type FrameworkId, isFramework } from "@/lib/docs/content/frameworks";
import { cn } from "@/lib/utils";

/**
 * Tabs with one tab per framework, valued by its id (`react`, `vue`, `svelte`,
 * `web`): the one shown is the framework the reader chose, else
 * `defaultValue`, and a tab picked chooses its framework for the whole site,
 * the sidebar and the hero with it. Every framework needs its tab.
 */
export function FrameworkTabs({
  className,
  defaultValue,
  ...props
}: Omit<
  React.ComponentProps<typeof Tabs>,
  "defaultValue" | "onValueChange" | "value"
> & {
  defaultValue: FrameworkId;
}) {
  const [framework, choose] = useFramework();
  const pick = useCallback(
    (value: unknown) => {
      if (isFramework(value)) {
        choose(value);
      }
    },
    [choose]
  );
  return (
    <Tabs
      className={cn("relative mt-6 w-full", className)}
      onValueChange={pick}
      value={framework ?? defaultValue}
      {...props}
    />
  );
}
