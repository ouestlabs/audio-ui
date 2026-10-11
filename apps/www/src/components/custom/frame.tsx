import Link from "next/link";
import type * as React from "react";

import { cn } from "@/lib/utils";

interface FrameProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  url?: string;
}

/** What a frame looks like, for a surface that cannot be a `Frame` itself, such as a popup. */
export const frameClassName =
  "relative flex flex-col overflow-hidden rounded-(--frame-radius) border border-site-border/80 bg-site-muted/50 p-0.5 shadow-black/5 shadow-none";

export const Frame = ({
  children,
  url,
  className,
  ref,
  ...props
}: FrameProps & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const outerClasses = cn(frameClassName, className);

  if (url) {
    return (
      <Link
        className={cn(
          outerClasses,
          "transition-shadow duration-200 ease-out hover:shadow-lg hover:ring-site-foreground/10"
        )}
        href={url}
        ref={ref as any}
      >
        {children}
      </Link>
    );
  }

  return (
    <div className={outerClasses} ref={ref} {...props}>
      {children}
    </div>
  );
};
Frame.displayName = "Frame";

export function FrameContent({
  children,
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-(--frame-radius-inner) border border-site-border bg-site-background",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );
}

export function FrameHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 p-3 font-site-sans", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function FrameFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 p-3 font-site-sans", className)}
      {...props}
    >
      {children}
    </div>
  );
}
