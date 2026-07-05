"use client";

import {
  SquareLock01Icon,
  SquareUnlock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type LockableParam, useLocks } from "@/app/(create)/hooks/use-locks";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function LockButton({
  param,
  className,
}: {
  param: LockableParam;
  className?: string;
}) {
  const { isLocked, toggleLock } = useLocks();
  const locked = isLocked(param);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={locked ? "Unlock" : "Lock"}
          className={cn(
            "site-rounded-sm flex pointer-coarse:hidden size-4 cursor-pointer items-center justify-center opacity-0 transition-opacity focus:opacity-100 group-focus-within/picker:opacity-100 group-hover/picker:opacity-100 data-[locked=true]:opacity-100",
            className
          )}
          data-locked={locked}
          onClick={() => toggleLock(param)}
          type="button"
        >
          <HugeiconsIcon
            className="size-5 text-site-foreground"
            icon={locked ? SquareLock01Icon : SquareUnlock01Icon}
            strokeWidth={2}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{locked ? "Unlock" : "Lock"}</TooltipContent>
    </Tooltip>
  );
}
