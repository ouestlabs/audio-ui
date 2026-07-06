"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConfig } from "@/hooks/use-config";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

interface CopyRegistryProps extends React.ComponentProps<typeof Button> {
  value: string;
}

export function CopyRegistry({ value, ...props }: CopyRegistryProps) {
  const [config] = useConfig();
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => setHasCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const copyToClipboard = React.useCallback(async () => {
    try {
      const pm = config?.packageManager || "pnpm";
      let command = "";

      switch (pm) {
        case "bun":
          command = `bunx --bun shadcn@latest add ${value}`;
          break;
        case "yarn":
          command = `yarn dlx shadcn@latest add ${value}`;
          break;
        case "npm":
          command = `npx shadcn@latest add ${value}`;
          break;
        default:
          command = `pnpm dlx shadcn@latest add ${value}`;
          break;
      }

      await navigator.clipboard.writeText(command);
      setHasCopied(true);

      trackEvent({
        name: "copy_component_cli",
        properties: {
          command,
          pm,
          base: config?.base,
          style: config?.style,
          iconLibrary: config?.iconLibrary,
        },
      });
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [
    value,
    config?.packageManager,
    config?.base,
    config?.iconLibrary,
    config?.style,
  ]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            onClick={copyToClipboard}
            size="icon"
            variant="outline"
            {...props}
          >
            <div className="relative">
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-in-out will-change-[opacity,filter,scale]",
                  hasCopied
                    ? "scale-100 opacity-100 blur-0"
                    : "scale-[0.25] opacity-0 blur-xs"
                )}
              >
                <CheckIcon />
              </div>
              <div
                className={cn(
                  "transition-[opacity,filter,scale] duration-300 ease-in-out will-change-[opacity,filter,scale]",
                  hasCopied
                    ? "scale-[0.25] opacity-0 blur-xs"
                    : "scale-100 opacity-100 blur-0"
                )}
              >
                <CopyIcon />
              </div>
            </div>
            <span className="sr-only">Copy registry URL</span>
          </Button>
        }
      />
      <TooltipContent>
        {hasCopied ? "Copied" : "Copy Registry URL"}
      </TooltipContent>
    </Tooltip>
  );
}
