"use client";
import { CheckIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Icons } from "@/lib/icons";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import { Kbd, KbdGroup } from "@/registry/default/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

export function CopyRegistry({
  value,
  className,
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string;
  src?: string;
}) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn(className)}
            data-slot="copy-button"
            onClick={() => copyToClipboard(value)}
            size="icon-sm"
            variant={variant}
            {...props}
          />
        }
      >
        <span className="sr-only">Copy</span>
        {isCopied ? <CheckIcon /> : <Icons.mcp />}
      </TooltipTrigger>
      <TooltipContent>
        {isCopied ? (
          "Copied"
        ) : (
          <KbdGroup>
            Copy Registry URL
            <Kbd>
              <Icons.mcp />
            </Kbd>
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
