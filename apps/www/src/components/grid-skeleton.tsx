"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface GridSkeletonProps {
  className?: string;
  count?: number;
  showHeader?: boolean;
}

export function GridSkeleton({
  count = 6,
  className,
  showHeader = true,
}: GridSkeletonProps) {
  return (
    <div className="flex flex-col">
      {showHeader && (
        <div className="sticky top-0 z-10 flex h-[51px] items-center gap-4 border-site-border border-b bg-site-background px-6">
          <Skeleton className="h-9 max-w-xs flex-1" />
          <Skeleton className="ml-auto h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      )}
      <div className={cn("p-6", className)}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: count }).map((_, i) => (
            <div
              className="site-rounded-xl relative flex h-full min-w-0 flex-col border border-site-border/60 bg-site-muted/30 p-0.5 shadow-black/5 shadow-xs"
              key={i}
            >
              <div className="flex min-h-50 min-w-0 flex-1 flex-col items-center justify-center rounded-t-[12px] rounded-b-[8px] border border-site-border bg-site-background/50 p-6 lg:px-8 lg:py-12">
                <Skeleton className="h-6 w-3/4" />
              </div>
              <div className="flex items-center gap-3 rounded-b-[12px] px-2 py-1.5">
                <Skeleton className="h-4 w-32" />
                <div className="ml-auto flex gap-1.5">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-7 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
