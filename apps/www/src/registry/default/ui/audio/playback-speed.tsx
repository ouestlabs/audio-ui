"use client";

import { GaugeIcon } from "lucide-react";
import React from "react";
import { useAudio } from "@/registry/default/hooks/use-audio";
import { useAudioStore } from "@/registry/default/lib/audio-store";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/registry/default/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
] as const;

export type AudioPlaybackSpeedProps = React.ComponentProps<typeof Button> & {
  speeds?: readonly { value: number; label: string }[];
};

interface AudioPlaybackSpeedButtonProps
  extends React.ComponentProps<typeof Button> {
  tooltipLabel?: string;
}

function AudioPlaybackSpeedButton({
  tooltipLabel,
  disabled,
  className,
  ...props
}: AudioPlaybackSpeedButtonProps) {
  const button = (
    <Button
      aria-label={props["aria-label"] ?? tooltipLabel}
      className={cn(
        "[&_svg.fill-current]:fill-primary [&_svg]:text-primary",
        className
      )}
      disabled={disabled}
      {...props}
    />
  );

  if (tooltipLabel) {
    const trigger = disabled ? (
      <span className="inline-block">{button}</span>
    ) : (
      button
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent sideOffset={4}>{tooltipLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function AudioPlaybackSpeed({
  className,
  size,
  variant = "outline",
  speeds = PLAYBACK_SPEEDS,
  ...props
}: AudioPlaybackSpeedProps) {
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const duration = useAudioStore((state) => state.duration);
  const { htmlAudio } = useAudio();
  const isLiveStream = htmlAudio.isLive(duration);

  const currentSpeed =
    speeds.find((s) => s.value === playbackRate) || speeds[2];
  const displayLabel = currentSpeed?.label;

  const handleSpeedChange = React.useCallback(
    (value: string) => {
      if (isLiveStream) {
        return;
      }
      const speed = Number.parseFloat(value);
      setPlaybackRate(speed);
    },
    [isLiveStream, setPlaybackRate]
  );

  const tooltipLabel = isLiveStream
    ? "Not available for live streams"
    : "Playback speed";

  const isIconSize = size === "icon";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isLiveStream}>
        <AudioPlaybackSpeedButton
          className={cn(className)}
          data-slot="audio-playback-speed-button"
          disabled={isLiveStream}
          size={size}
          tooltipLabel={tooltipLabel}
          variant={variant}
          {...props}
        >
          {!isIconSize && <GaugeIcon className="size-4" />}
          <span className="font-mono text-xs">{displayLabel}</span>
        </AudioPlaybackSpeedButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("w-40", className)}
        data-slot="audio-playback-speed-content"
      >
        <DropdownMenuLabel className="text-muted-foreground">
          Playback Speed
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={handleSpeedChange}
          value={String(playbackRate)}
        >
          {speeds.map((speed) => (
            <DropdownMenuRadioItem
              key={speed.value}
              value={String(speed.value)}
            >
              {speed.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AudioPlaybackSpeed };
