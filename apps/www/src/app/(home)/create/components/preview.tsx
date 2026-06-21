import type { ReactNode } from "react";

export function BuilderPreview({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar relative min-h-0 flex-1 overflow-auto rounded-2xl border bg-muted p-4 md:p-6 dark:bg-muted/30">
      {children}
    </div>
  );
}
