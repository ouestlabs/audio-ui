import { GridSkeleton } from "@/components/grid-skeleton";

/** The catalog streams into the panel: until its cards arrive, their frames. */
export default function Loading() {
  return <GridSkeleton count={6} />;
}
