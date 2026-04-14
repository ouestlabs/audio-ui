"use client";

import { GaugeIcon } from "@phosphor-icons/react";
import React from "react";
import { useAudio } from "@/registry/default/hooks/use-audio";
import { useAudioStore } from "@/registry/default/lib/audio-store";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
  children,
  ...props
}: AudioPlaybackSpeedButtonProps) {
  const buttonClassName = cn("[&_svg]:text-primary", className);

  if (tooltipLabel) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            disabled ? (
              <Button
                aria-label={props["aria-label"] ?? tooltipLabel}
                className={buttonClassName}
                disabled={disabled}
                {...props}
              />
            ) : (
              <Button
                aria-label={props["aria-label"] ?? tooltipLabel}
                className={buttonClassName}
                disabled={disabled}
                {...props}
              />
            )
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>{tooltipLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      aria-label={props["aria-label"] ?? tooltipLabel}
      className={buttonClassName}
      disabled={disabled}
      {...props}
    >
      {children}
    </Button>
  );
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
      <DropdownMenuTrigger
        disabled={isLiveStream}
        render={
          <AudioPlaybackSpeedButton
            className={cn(className)}
            data-slot="audio-playback-speed-button"
            disabled={isLiveStream}
            size={size}
            tooltipLabel={tooltipLabel}
            variant={variant}
            {...props}
          />
        }
      >
        {!isIconSize && <GaugeIcon />}
        <span className="font-mono text-xs">{displayLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(className)}
        data-slot="audio-playback-speed-content"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
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
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AudioPlaybackSpeed };
