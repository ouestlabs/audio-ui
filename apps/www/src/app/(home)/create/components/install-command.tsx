"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import { useBuilder } from "./builder-provider";

export function InstallCommand() {
  const { params } = useBuilder();
  const command = `npx shadcn@latest add https://audio-ui.xyz/r/${params.style}/player.json`;
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        Install command
      </p>
      <div className="flex items-center gap-2 overflow-hidden rounded-lg border bg-muted/50 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          {command}
        </code>
        <Button
          aria-label={isCopied ? "Copied" : "Copy install command"}
          className={cn("shrink-0")}
          onClick={() => copyToClipboard(command)}
          size="icon-sm"
          variant="ghost"
        >
          {isCopied ? (
            <CheckIcon aria-hidden="true" className="size-4" />
          ) : (
            <CopyIcon aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
