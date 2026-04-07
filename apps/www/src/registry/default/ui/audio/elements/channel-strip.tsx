"use client";

import { ChannelStrip as ChannelStripPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/default/lib/utils";

export function ChannelStrip({
  className,
  ...props
}: ChannelStripPrimitive.RootProps) {
  return (
    <ChannelStripPrimitive.Root
      className={cn(
        "group/channel-strip mx-auto inline-flex rounded-xl border bg-card p-4 text-card-foreground shadow-sm",
        "data-[orientation=vertical]:w-max data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-center data-[orientation=vertical]:justify-center data-[orientation=vertical]:gap-4",
        "data-[orientation=horizontal]:flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:items-stretch data-[orientation=horizontal]:gap-3",
        "data-[orientation=horizontal]:has-data-footer:grid data-[orientation=horizontal]:has-data-footer:grid-cols-1 data-[orientation=horizontal]:has-data-footer:gap-y-3",
        "data-[orientation=horizontal]:has-data-footer:grid-rows-[auto_minmax(0,1fr)_auto]",
        "data-[orientation=horizontal]:has-data-footer:*:data-header:col-start-1 data-[orientation=horizontal]:has-data-footer:*:data-header:row-start-1",
        "data-[orientation=horizontal]:has-data-footer:*:data-content:row-start-2 data-[orientation=horizontal]:has-data-footer:*:data-content:min-h-0 data-[orientation=horizontal]:has-data-footer:*:data-content:min-w-0",
        "data-[orientation=horizontal]:has-data-footer:*:data-footer:col-start-1 data-[orientation=horizontal]:has-data-footer:*:data-footer:row-start-3 data-[orientation=horizontal]:has-data-footer:*:data-footer:self-end",
        "md:data-[orientation=horizontal]:has-data-footer:grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] md:data-[orientation=horizontal]:has-data-footer:grid-rows-[auto_auto] md:data-[orientation=horizontal]:has-data-footer:items-stretch md:data-[orientation=horizontal]:has-data-footer:gap-x-6 md:data-[orientation=horizontal]:has-data-footer:gap-y-3",
        "md:data-[orientation=horizontal]:has-data-footer:*:data-header:col-start-1 md:data-[orientation=horizontal]:has-data-footer:*:data-header:row-start-1 md:data-[orientation=horizontal]:has-data-footer:*:data-header:self-start",
        "md:data-[orientation=horizontal]:has-data-footer:*:data-footer:col-start-1 md:data-[orientation=horizontal]:has-data-footer:*:data-footer:row-start-2 md:data-[orientation=horizontal]:has-data-footer:*:data-footer:self-start",
        "md:data-[orientation=horizontal]:has-data-footer:*:data-content:col-start-2 md:data-[orientation=horizontal]:has-data-footer:*:data-content:row-span-2 md:data-[orientation=horizontal]:has-data-footer:*:data-content:row-start-1 md:data-[orientation=horizontal]:has-data-footer:*:data-content:min-h-0 md:data-[orientation=horizontal]:has-data-footer:*:data-content:min-w-0 md:data-[orientation=horizontal]:has-data-footer:*:data-content:self-stretch",
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
        "w-full text-center font-medium text-sm",
        "group-data-[orientation=horizontal]/channel-strip:text-left",
        "group-data-[orientation=horizontal]/channel-strip:flex group-data-[orientation=horizontal]/channel-strip:w-full group-data-[orientation=horizontal]/channel-strip:items-center group-data-[orientation=horizontal]/channel-strip:justify-between",
        className
      )}
      {...props}
    />
  );
}

export function ChannelStripContent({
  className,
  layout = "stack",
  ...props
}: ChannelStripPrimitive.ContentProps) {
  return (
    <ChannelStripPrimitive.Content
      className={cn(
        "flex w-full flex-col gap-3",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:flex-row",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:flex-wrap",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:items-stretch",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:justify-center",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:gap-4",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:*:data-section:min-w-0",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:*:data-section:flex-1",
        "group-data-[orientation=vertical]/channel-strip:data-[layout=row]:md:*:data-section:basis-0",
        "group-data-[orientation=horizontal]/channel-strip:min-h-0 group-data-[orientation=horizontal]/channel-strip:min-w-0",
        "group-data-[orientation=horizontal]/channel-strip:justify-center group-data-[orientation=horizontal]/channel-strip:gap-4",
        "md:group-data-[orientation=horizontal]/channel-strip:flex-1 md:group-data-[orientation=horizontal]/channel-strip:items-stretch md:group-data-[orientation=horizontal]/channel-strip:justify-center md:group-data-[orientation=horizontal]/channel-strip:gap-4",
        className
      )}
      layout={layout}
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
        "w-full text-center text-muted-foreground text-xs",
        "group-data-[orientation=horizontal]/channel-strip:text-left",
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
        "flex w-full",
        "data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-center data-[orientation=vertical]:justify-center data-[orientation=vertical]:gap-3",
        "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-0 data-[orientation=horizontal]:items-center data-[orientation=horizontal]:justify-between data-[orientation=horizontal]:gap-4",
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
        "text-center text-muted-foreground text-xs uppercase",
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
        "min-w-12 text-center font-medium text-muted-foreground text-sm tabular-nums",
        className
      )}
      {...props}
    />
  );
}
