import {
  Frame,
  FrameContent,
  FrameFooter,
  FrameHeader,
} from "@/components/custom/frame";
import { Skeleton } from "@/components/ui/skeleton";

const SIDEBAR_ROWS = [64, 80, 48, 72, 56, 88, 60, 76] as const;
const CUSTOMIZER_ROWS = 10;

/** The navigation sidebar's shape: the logo, the tabs, the search and a list. */
function NavigationSkeleton() {
  return (
    <aside
      aria-hidden
      className="hidden w-64 shrink-0 flex-col gap-2 p-2 lg:flex"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="size-8" />
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <div className="mt-3 flex flex-col gap-3 px-2">
        {SIDEBAR_ROWS.map((width) => (
          <Skeleton
            className="h-4"
            key={width}
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    </aside>
  );
}

/** The customizer's shape: a label and a value for each choice. */
function CustomizerSkeleton() {
  return (
    <aside
      aria-hidden
      className="hidden w-64 shrink-0 flex-col gap-4 p-4 lg:flex"
    >
      {Array.from({ length: CUSTOMIZER_ROWS }).map((_, index) => (
        <div className="flex items-center justify-between" key={index}>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="size-4 rounded-full" />
        </div>
      ))}
    </aside>
  );
}

/**
 * What stands in for the framed layout while its page loads: the two sidebars
 * and the inset's frame (a bar, a panel, a footer), laid out as they will be so
 * nothing moves when the page arrives. `children` fill the panel.
 */
export function FramedLayoutSkeleton({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0">
      <NavigationSkeleton />
      <div className="min-h-0 min-w-0 flex-1 p-2 pt-0 lg:px-0 lg:pt-2">
        <Frame aria-busy className="h-full" role="status">
          <FrameHeader className="min-h-11 shrink-0 flex-row items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-8" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="size-8" />
            </div>
          </FrameHeader>
          <FrameContent className="min-h-0 flex-1 overflow-hidden">
            {children}
          </FrameContent>
          <FrameFooter className="h-10 shrink-0 flex-row items-center justify-center py-0">
            <Skeleton className="h-3 w-56" />
          </FrameFooter>
        </Frame>
      </div>
      <CustomizerSkeleton />
    </div>
  );
}
