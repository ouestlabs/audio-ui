"use client";

import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";

interface PlayToggleProps {
  className?: string;
  /** What the button says when it is stopped. @default "Play" */
  label?: string;
  onToggle: () => void;
  playing: boolean;
}

/** A play and pause button for a demo signal: the icon follows `playing`, the name says what pressing it does. */
function PlayToggle({
  className,
  label = "Play",
  onToggle,
  playing,
}: PlayToggleProps) {
  return (
    <Button
      aria-label={playing ? "Stop" : label}
      className={className}
      onClick={onToggle}
      size="icon-xs"
      variant="outline"
    >
      {playing ? (
        <IconPlaceholder
          hugeicons="PauseIcon"
          lucide="PauseIcon"
          phosphor="PauseIcon"
          remixicon="RiPauseLine"
          tabler="IconPlayerPause"
        />
      ) : (
        <IconPlaceholder
          hugeicons="PlayIcon"
          lucide="PlayIcon"
          phosphor="PlayIcon"
          remixicon="RiPlayLine"
          tabler="IconPlayerPlay"
        />
      )}
    </Button>
  );
}

export { PlayToggle };
