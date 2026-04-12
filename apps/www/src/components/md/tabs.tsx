import type * as React from "react";
import { cn } from "@/registry/default/lib/utils";
import {
  Tabs as UITabs,
  TabsContent as UITabsContent,
  TabsList as UITabsList,
  TabsTrigger as UITabsTrigger,
} from "@/registry/default/ui/tabs";

function Tabs({ className, ...props }: React.ComponentProps<typeof UITabs>) {
  return <UITabs className={cn(className)} {...props} />;
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof UITabsList>) {
  return (
    <UITabsList className={cn("bg-transparent p-0", className)} {...props} />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof UITabsTrigger>) {
  return (
    <UITabsTrigger
      className={cn(
        "rounded-4xl data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-none",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof UITabsContent>) {
  return (
    <UITabsContent
      className={cn(
        "relative [&>.steps]:mt-6 [&_h3]:font-medium [&_h3]:text-base *:[figure]:first:mt-0",
        className
      )}
      {...props}
    />
  );
}

function Tab({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(className)} {...props} />;
}

export { Tab, Tabs, TabsContent, TabsList, TabsTrigger };
