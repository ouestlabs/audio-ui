"use client";

import { ChannelStrip as ChannelStripPrimitive } from "@audio-ui/react";
import { cn } from "@/lib/utils";

export function ChannelStrip({
  className,
  ...props
}: ChannelStripPrimitive.RootProps) {
  return (
    <ChannelStripPrimitive.Root
      className={cn(
        "inline-flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-center data-[orientation=horizontal]:gap-4 dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
      {...props}
    />
  );
}

export function ChannelStripHeader({
  className,
  ...props
}: ChannelStripPrimitive.HeaderProps) {
  return (
    <ChannelStripPrimitive.Header
      className={cn(
        "w-full text-center font-medium text-sm text-zinc-900 data-[orientation=horizontal]:w-auto data-[orientation=horizontal]:text-left dark:text-zinc-100",
        className
      )}
      {...props}
    />
  );
}

export function ChannelStripContent({
  className,
  ...props
}: ChannelStripPrimitive.ContentProps) {
  return (
    <ChannelStripPrimitive.Content
      className={cn(
        "flex w-full flex-col items-center gap-3 data-[orientation=horizontal]:flex-1",
        className
      )}
      {...props}
    />
  );
}

export function ChannelStripFooter({
  className,
  ...props
}: ChannelStripPrimitive.FooterProps) {
  return (
    <ChannelStripPrimitive.Footer
      className={cn(
        "w-full text-center text-xs text-zinc-500 data-[orientation=horizontal]:w-auto data-[orientation=horizontal]:text-left dark:text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

export function ChannelStripSection({
  className,
  ...props
}: ChannelStripPrimitive.SectionProps) {
  return (
    <ChannelStripPrimitive.Section
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:gap-4",
        className
      )}
      {...props}
    />
  );
}

export function ChannelStripLabel({
  className,
  ...props
}: ChannelStripPrimitive.LabelProps) {
  return (
    <ChannelStripPrimitive.Label
      className={cn(
        "text-center text-xs text-zinc-500 uppercase dark:text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

export function ChannelStripValue({
  className,
  ...props
}: ChannelStripPrimitive.ValueProps) {
  return (
    <ChannelStripPrimitive.Value
      className={cn(
        "min-w-12 text-center font-medium text-sm text-zinc-500 tabular-nums dark:text-zinc-400",
        className
      )}
      {...props}
    />
  );
}
