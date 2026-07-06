"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Event, trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

export function copyToClipboardWithMeta(value: string, event?: Event) {
  navigator.clipboard.writeText(value);
  if (event) {
    trackEvent(event);
  }
}

export function CopyButton({
  value,
  className,
  variant = "ghost",
  event,
  properties,
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string;
  src?: string;
  event?: Event["name"];
  properties?: Record<string, any>;
}) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn(
              "absolute top-3 right-2 z-10 bg-site-code hover:opacity-100 focus-visible:opacity-100",
              className
            )}
            data-slot="copy-button"
            onClick={() => {
              copyToClipboardWithMeta(
                value,
                event
                  ? {
                      name: event,
                      properties: {
                        code: value,
                        ...properties,
                      },
                    }
                  : undefined
              );
              setHasCopied(true);
            }}
            size="icon"
            variant={variant}
            {...props}
          >
            <span className="sr-only">Copy</span>
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
          </Button>
        }
      />
      <TooltipContent>
        {hasCopied ? "Copied" : "Copy to Clipboard"}
      </TooltipContent>
    </Tooltip>
  );
}
