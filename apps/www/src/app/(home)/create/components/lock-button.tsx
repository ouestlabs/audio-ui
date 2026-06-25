"use client";

import { LockIcon, LockOpenIcon } from "@phosphor-icons/react";
import { cn } from "@/registry/bases/base/lib/utils";
import { useLocks } from "../hooks/use-locks";
import type { BuilderSearchParams } from "../lib/search-params";

export function LockButton({
  param,
  className,
}: {
  param: keyof BuilderSearchParams;
  className?: string;
}) {
  const { isLocked, toggleLock } = useLocks();
  const locked = isLocked(param);

  return (
    <button
      aria-label={locked ? `Unlock ${param}` : `Lock ${param}`}
      className={cn(
        "-translate-y-1/2 absolute top-1/2 right-9 z-10",
        "flex size-5 items-center justify-center rounded-md",
        "text-muted-foreground transition-opacity",
        "opacity-0 hover:bg-foreground/10 hover:text-foreground group-hover/picker:opacity-100",
        locked && "text-foreground opacity-100",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        toggleLock(param);
      }}
      type="button"
    >
      {locked ? (
        <LockIcon aria-hidden="true" className="size-3" />
      ) : (
        <LockOpenIcon aria-hidden="true" className="size-3" />
      )}
    </button>
  );
}
