"use client";

import { MicrophoneIcon, MicrophoneSlashIcon } from "@phosphor-icons/react/ssr";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMicrophoneSwitch } from "@/registry-audio/bases/base/hooks/use-microphone";

/** The bars showing the switch: the card's, and the expanded view's while it is open. */
let bars = 0;

/**
 * Turns the microphone on for a preview from its bar, for the previews that
 * show a signal and can listen to yours. Nothing is recorded or played back,
 * and the microphone is released when the last bar goes, so expanding a
 * preview, or closing it again, does not cut it.
 */
export function MicrophoneSwitch() {
  const { error, on, setOn, toggle } = useMicrophoneSwitch();
  useEffect(() => {
    bars += 1;
    return () => {
      bars -= 1;
      if (bars === 0) {
        setOn(false);
      }
    };
  }, [setOn]);
  const Icon = on ? MicrophoneSlashIcon : MicrophoneIcon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={on ? "Turn the microphone off" : "Use the microphone"}
            aria-pressed={on}
            className="shrink-0 aria-pressed:bg-site-accent"
            onClick={toggle}
            size="icon"
            variant="outline"
          >
            <Icon aria-hidden="true" />
          </Button>
        }
      />
      <TooltipContent>
        {error ?? (on ? "Listening. Click to stop." : "Show your own sound")}
      </TooltipContent>
    </Tooltip>
  );
}
