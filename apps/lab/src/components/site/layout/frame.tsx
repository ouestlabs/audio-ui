import { cn } from "cn";
import type * as React from "react";

/** What a frame looks like, for a surface that cannot be a `Frame` itself, such as a link: the docs' rounded border around an inner surface. */
export const frameClassName =
  "relative flex flex-col overflow-hidden rounded-xl border bg-muted/50 p-0.5";

export function Frame({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(frameClassName, className)} {...props} />;
}

export function FrameHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 px-2 py-1.5",
        className
      )}
      {...props}
    />
  );
}

export function FrameContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[calc(var(--radius-xl)-2px)] border bg-background",
        className
      )}
      {...props}
    />
  );
}

export function FrameFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1 p-3", className)} {...props} />
  );
}
