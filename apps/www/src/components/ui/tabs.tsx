import {
  TabsIndicator,
  TabsList as TabsListPrimitive,
  TabsPanel,
  Tabs as TabsPrimitive,
  TabsTab,
} from "@ui-sdk/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

function Tabs({
  activation = "manual",
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive>) {
  return (
    <TabsPrimitive
      activation={activation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground data-[variant=line]:rounded-none group-data-[orientation=horizontal]/tabs:h-8 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
  }
);

function TabsList({
  children,
  className,
  variant = "default",
  ...props
}: Omit<ComponentProps<typeof TabsListPrimitive>, "children"> & {
  children?: ReactNode;
} & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsListPrimitive
      className={cn(tabsListVariants({ variant }), "relative", className)}
      data-variant={variant}
      {...props}
    >
      {variant === "default" && (
        <TabsIndicator className="absolute top-(--active-tab-top) left-(--active-tab-left) z-0 h-(--active-tab-height) w-(--active-tab-width) rounded-md bg-background shadow-sm transition-[top,left,width,height] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,left,width,height] data-[activation-direction=none]:transition-none motion-reduce:transition-none dark:border dark:border-input dark:bg-input/30" />
      )}
      {children}
    </TabsListPrimitive>
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsTab>) {
  return (
    <TabsTab
      className={cn(
        "relative z-1 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-1.5 py-0.5 font-medium text-foreground/60 text-sm transition hover:text-foreground focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start group-data-[variant=line]/tabs-list:data-selected:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-selected:bg-transparent dark:group-data-[variant=line]/tabs-list:data-selected:border-transparent dark:group-data-[variant=line]/tabs-list:data-selected:bg-transparent",
        "data-selected:text-foreground dark:data-selected:text-foreground",
        "group-data-[orientation=vertical]/tabs:after:-right-1 after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-selected:after:opacity-100",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPanel>) {
  return (
    <TabsPanel
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
