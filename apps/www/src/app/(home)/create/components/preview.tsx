import type { ReactNode } from "react";

export function BuilderPreview({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-auto rounded-2xl border bg-muted dark:bg-muted/30">
      {children}
    </div>
  );
}
