import type { ReactNode } from "react";

export function BuilderPreview({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border bg-muted p-4 md:p-6 dark:bg-muted/30">
      <div className="mx-auto w-full">{children}</div>
    </div>
  );
}
