"use client";

import { PauseIcon, PlayIcon } from "@phosphor-icons/react/ssr";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";

/**
 * Plays and stops the sound of a preview from its bar, for the previews that
 * show a signal and make none of their own: they follow the page's play
 * switch. It stops when the bar goes.
 */
export function PlaySwitch() {
  const { playing, setPlaying, toggle } = usePlaySwitch();
  useEffect(() => () => setPlaying(false), [setPlaying]);
  const Icon = playing ? PauseIcon : PlayIcon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={playing ? "Stop" : "Play"}
            aria-pressed={playing}
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
        {playing ? "Stop" : "Play a sound through it"}
      </TooltipContent>
    </Tooltip>
  );
}
