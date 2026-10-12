"use client";

import { type ComponentProps, createContext, use } from "react";
import { cn } from "@/lib/utils";

type Orientation = "horizontal" | "vertical";

const ChannelStripOrientationContext = createContext<Orientation>("vertical");

export function ChannelStrip({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<"section"> & { orientation?: Orientation }) {
  return (
    <ChannelStripOrientationContext value={orientation}>
      <section
        className={cn(
          "inline-flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-center data-[orientation=horizontal]:gap-4 dark:border-zinc-800 dark:bg-zinc-900",
          className
        )}
        data-orientation={orientation}
        data-root=""
        {...props}
      />
    </ChannelStripOrientationContext>
  );
}

export function ChannelStripHeader({
  className,
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "w-full text-center font-medium text-sm text-zinc-900 data-[orientation=horizontal]:w-auto data-[orientation=horizontal]:text-left dark:text-zinc-100",
        className
      )}
      data-header=""
      {...props}
    />
  );
}

export function ChannelStripContent({
  className,
  layout = "stack",
  ...props
}: ComponentProps<"div"> & { layout?: "stack" | "row" }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-3 data-[orientation=horizontal]:flex-1",
        className
      )}
      data-content=""
      data-layout={layout}
      {...props}
    />
  );
}

export function ChannelStripFooter({
  className,
  ...props
}: ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "w-full text-center text-xs text-zinc-500 data-[orientation=horizontal]:w-auto data-[orientation=horizontal]:text-left dark:text-zinc-400",
        className
      )}
      data-footer=""
      {...props}
    />
  );
}

export function ChannelStripSection({
  className,
  orientation,
  ...props
}: ComponentProps<"div"> & { orientation?: Orientation }) {
  const inheritedOrientation = use(ChannelStripOrientationContext);
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:gap-4",
        className
      )}
      data-orientation={orientation ?? inheritedOrientation}
      data-section=""
      {...props}
    />
  );
}

export function ChannelStripLabel({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-center text-xs text-zinc-500 uppercase dark:text-zinc-400",
        className
      )}
      data-label=""
      {...props}
    />
  );
}

export function ChannelStripValue({
  className,
  ...props
}: ComponentProps<"output">) {
  return (
    <output
      aria-live="polite"
      className={cn(
        "min-w-12 text-center font-medium text-sm text-zinc-500 tabular-nums dark:text-zinc-400",
        className
      )}
      data-value=""
      {...props}
    />
  );
}
