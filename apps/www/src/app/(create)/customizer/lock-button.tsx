"use client";

import { LockSimpleIcon, LockSimpleOpenIcon } from "@phosphor-icons/react/ssr";
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
      <TooltipTrigger
        render={
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
            {locked ? (
              <LockSimpleIcon className="size-5 text-site-foreground" />
            ) : (
              <LockSimpleOpenIcon className="size-5 text-site-foreground" />
            )}
          </button>
        }
      />
      <TooltipContent>{locked ? "Unlock" : "Lock"}</TooltipContent>
    </Tooltip>
  );
}
