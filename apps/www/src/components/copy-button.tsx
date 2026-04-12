"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import posthog from "posthog-js";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import { Kbd, KbdGroup } from "@/registry/default/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

function CopyButton({
  value,
  className,
  variant = "ghost",
  tooltip = "Copy to Clipboard",
  src,
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string;
  src?: string;
  tooltip?: string;
}) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({
    onCopy: () => {
      posthog.capture("text_copied_to_clipboard", {
        source: src,
        copied_text_length: value.length,
      });
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn(
              "absolute top-3 right-2 z-10 bg-code hover:opacity-100 focus-visible:opacity-100",
              className
            )}
            data-copied={isCopied}
            data-slot="copy-button"
            onClick={() => copyToClipboard(value)}
            size="icon"
            variant={variant}
            {...props}
          />
        }
      >
        <span className="sr-only">Copy</span>
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </TooltipTrigger>
      <TooltipContent>
        {isCopied ? (
          "Copied"
        ) : (
          <KbdGroup>
            {tooltip}
            <Kbd>
              <CopyIcon />
            </Kbd>
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export { CopyButton };
