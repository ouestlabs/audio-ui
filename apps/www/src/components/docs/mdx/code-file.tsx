"use client";

import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * One file of an example: its name as a row that opens and closes its code,
 * for an example made of several files to read one at a time.
 */
export function CodeFile({
  children,
  open: initiallyOpen = false,
  title,
}: {
  children: ReactNode;
  /** Whether the file is open at first. */
  open?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  return (
    <div className="border-site-border border-b last:border-b-0">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-mono text-site-muted-foreground text-xs hover:text-site-foreground"
        onClick={toggle}
        type="button"
      >
        <CaretRightIcon
          aria-hidden
          className={cn("size-3 transition-transform", open && "rotate-90")}
        />
        {title}
      </button>
      {open ? <div className="[&_figure]:my-0">{children}</div> : null}
    </div>
  );
}
