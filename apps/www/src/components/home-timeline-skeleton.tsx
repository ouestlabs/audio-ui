import { Skeleton } from "@/components/ui/skeleton";

const TRACKS = ["drums", "bass", "keys"];

/** The home's timeline before it is drawn: the same bands (toolbar, overview, ruler, three tracks), so nothing jumps when it appears. */
export function HomeTimelineSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="ml-auto h-10 w-48 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Skeleton className="h-10 w-full rounded-md" />
        {TRACKS.map((track) => (
          <Skeleton className="min-h-20 w-full flex-1 rounded-md" key={track} />
        ))}
      </div>
    </div>
  );
}
