import { cn } from "@/lib/utils";

interface ComponentEmptyStateProps {
  className?: string;
  message: string;
}

export function ComponentEmptyState({
  message,
  className,
}: ComponentEmptyStateProps) {
  return (
    <div className={cn("py-12 text-center", className)}>
      <p className="text-site-muted-foreground">{message}</p>
    </div>
  );
}
