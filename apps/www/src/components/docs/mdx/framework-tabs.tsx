import { useCallback } from "react";
import { Tabs } from "@/components/ui/tabs";
import { useFramework } from "@/hooks/use-framework";
import { type FrameworkId, isFramework } from "@/lib/docs/content/frameworks";
import { cn } from "@/lib/utils";

/**
 * Tabs with one tab per framework, valued by its id (`react`, `vue`, `svelte`,
 * `web`). With a framework chosen, only its tab's content shows, the tabs
 * themselves hidden: the site shows a reader what is theirs. With none, the
 * tabs show from `defaultValue`, and a tab picked chooses its framework for
 * the whole site. Every framework needs its tab.
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
      className={cn(
        "relative mt-6 w-full",
        // The framework's own content alone: its tabs are not shown, and the nested ones (package managers) are kept.
        framework && "[&>[data-slot=tabs-list]]:hidden",
        className
      )}
      onValueChange={pick}
      value={framework ?? defaultValue}
      {...props}
    />
  );
}
