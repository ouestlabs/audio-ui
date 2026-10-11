"use client";

import { Frame, FrameContent, FrameFooter } from "@/components/custom/frame";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface GridSkeletonProps {
  className?: string;
  count?: number;
}

/** The catalog's cards before they arrive: a frame with a panel and a footer, as the cards have. */
export function GridSkeleton({ count = 6, className }: GridSkeletonProps) {
  return (
    <div className={cn("p-3 sm:px-8 sm:py-6 xl:px-10", className)}>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {Array.from({ length: count }).map((_, index) => (
          <Frame key={index}>
            <FrameContent className="flex min-h-60 items-center justify-center p-4">
              <Skeleton className="h-6 w-3/4" />
            </FrameContent>
            <FrameFooter className="flex-row items-center gap-3 px-2 py-1.5">
              <Skeleton className="h-4 w-32" />
              <div className="ml-auto flex gap-1.5">
                <Skeleton className="size-8" />
                <Skeleton className="h-8 w-20" />
              </div>
            </FrameFooter>
          </Frame>
        ))}
      </div>
    </div>
  );
}
