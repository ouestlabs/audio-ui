"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { ACTION_BUTTON_CLASS } from "@/components/customizer/actions/action-button";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { usePresetCode } from "@/hooks/use-preset-code";
import { trackEvent } from "@/lib/events";

/** The code of the design on screen, as the command's flag: one click copies it. */
export function CopyPreset() {
  const code = usePresetCode();
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  const handleClick = React.useCallback(() => {
    copyToClipboard(`--preset ${code}`);
    trackEvent({ name: "copy_preset_command", properties: { preset: code } });
  }, [code, copyToClipboard]);

  return (
    <Button
      aria-label={`Copy preset ${code}`}
      className={ACTION_BUTTON_CLASS}
      onClick={handleClick}
      size="sm"
      variant="ghost"
    >
      <div className="flex min-w-0 flex-col justify-start text-left">
        <div className="text-site-muted-foreground text-xs">Preset</div>
        <div className="truncate font-medium text-site-foreground text-sm">
          {isCopied ? "Copied" : `--preset ${code}`}
        </div>
      </div>
      {isCopied ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
    </Button>
  );
}
