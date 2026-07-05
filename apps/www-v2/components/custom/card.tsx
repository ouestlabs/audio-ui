import Link from "next/link";
import type React from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  url,
}: {
  children: React.ReactNode;
  className?: string;
  url?: string;
}) {
  const outerClasses = cn(
    "relative flex items-stretch overflow-hidden rounded-[16px] border border-site-border/60 bg-site-background/60 p-0.5 dark:bg-site-background/20",
    url &&
      "hover:-translate-y-1 break-inside-avoid transition-all hover:shadow-md"
  );

  const innerContent = (
    <div
      className={cn(
        "site-rounded-xl relative flex w-full flex-col gap-6 border border-site-border/60 bg-site-background bg-clip-padding p-6 shadow-xs before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(1rem-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-site-background/30 dark:bg-clip-border dark:before:shadow-[0_-1px_--theme(--color-white/8%)]",
        className
      )}
    >
      {children}
    </div>
  );

  if (url) {
    return (
      <Link className={outerClasses} href={url}>
        {innerContent}
      </Link>
    );
  }

  return <div className={outerClasses}>{innerContent}</div>;
}
