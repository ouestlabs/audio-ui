import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

interface FrameProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  url?: string;
}

export const Frame = React.forwardRef<HTMLDivElement, FrameProps>(
  ({ children, url, className, ...props }, ref) => {
    const outerClasses = cn(
      "relative flex flex-col overflow-hidden rounded-[16px] border border-site-border/80 bg-site-background p-0.5 shadow-black/5 shadow-sm",
      className
    );

    if (url) {
      return (
        <Link
          className={cn(
            outerClasses,
            "transition-all hover:shadow-lg hover:ring-site-foreground/10"
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
  }
);
Frame.displayName = "Frame";

export function FrameContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "site-rounded-xl relative overflow-hidden border border-site-border",
        className
      )}
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
