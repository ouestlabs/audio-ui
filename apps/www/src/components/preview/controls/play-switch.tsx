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
 * show a signal and make none of their own: they follow the play switch of
 * their own session. It stops when the last bar of the session goes (the
 * card's, and the expanded view's while it is open), so expanding a preview,
 * or closing it again, does not cut the sound.
 */
export function PlaySwitch() {
  const { attach, playing, toggle } = usePlaySwitch();
  useEffect(() => attach(), [attach]);
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
