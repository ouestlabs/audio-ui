import { Skeleton } from "@/components/ui/skeleton";

const LINES = [100, 92, 96, 70] as const;

/** A docs page streams into the panel: until it arrives, the shape of its title, its lead and its first lines. */
export default function Loading() {
  return (
    <div
      aria-busy
      className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 md:px-0 lg:py-8"
      role="status"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex flex-col gap-3">
        {LINES.map((width) => (
          <Skeleton
            className="h-4"
            key={width}
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
