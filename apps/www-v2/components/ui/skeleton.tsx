import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("site-rounded-md animate-pulse bg-site-accent", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
