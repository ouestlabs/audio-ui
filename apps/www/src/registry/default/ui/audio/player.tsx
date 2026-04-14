"use client";

import type { BaseUIEvent } from "@base-ui/react";
import {
  BroadcastIcon,
  FastForwardIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SpeakerHighIcon,
  SpeakerLowIcon,
  SpeakerNoneIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { useAudio } from "@/registry/default/hooks/use-audio";
import { useAudioStore } from "@/registry/default/lib/audio-store";
import { formatDuration } from "@/registry/default/lib/html-audio";
import { cn } from "@/registry/default/lib/utils";
import { Fader } from "@/registry/default/ui/audio/elements/fader";
import { Transport } from "@/registry/default/ui/audio/elements/transport";
import { Button, type buttonVariants } from "@/registry/default/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/default/ui/dropdown-menu";
import { Spinner } from "@/registry/default/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

interface AudioPlayerButtonProps extends React.ComponentProps<typeof Button> {
  tooltipLabel?: string;
}

function AudioPlayerButton({
  tooltipLabel,
  className,
  ...props
}: AudioPlayerButtonProps) {
  const button = (
    <Button
      aria-label={props["aria-label"] ?? tooltipLabel}
      className={cn("[&_svg]:text-primary", className)}
      {...props}
    />
  );

  if (tooltipLabel) {
    return (
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent sideOffset={4}>{tooltipLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function AudioPlayer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-full rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10",
        className
      )}
      data-slot="audio-player"
      role="presentation"
      {...props}
    >
      {children}
    </div>
  );
}

const audioControlBarVariants = cva(
  "group/audio-control-bar flex w-full min-w-0 items-center gap-1.5",
  {
    variants: {
      variant: {
        compact: "flex-row",
        stacked: "flex-col",
      },
    },
    defaultVariants: {
      variant: "compact",
    },
  }
);

/**
 * Props for the AudioPlayerControlBar component.
 */
export type AudioPlayerControlBarProps = React.ComponentProps<"div"> &
  VariantProps<typeof audioControlBarVariants>;

const AudioPlayerControlBar = ({
  className,
  variant,
  ...props
}: AudioPlayerControlBarProps) => (
  <div
    className={cn(audioControlBarVariants({ variant }), className)}
    data-slot="audio-control-bar"
    data-variant={variant}
    {...props}
  />
);

/**
 * Props for the AudioPlayerControlGroup component.
 */
export type AudioPlayerControlGroupProps = React.ComponentProps<"div">;

const AudioPlayerControlGroup = ({
  className,
  ...props
}: AudioPlayerControlGroupProps) => (
  <div
    className={cn("flex w-full items-center gap-1.5", className)}
    data-slot="audio-control-group"
    {...props}
  />
);

/**
 * Props for the AudioPlayerTimeDisplay component.
 */
export type AudioPlayerTimeDisplayProps = React.ComponentProps<"time"> & {
  remaining?: boolean;
};

const AudioPlayerTimeDisplay = ({
  className,
  remaining,
  ...props
}: AudioPlayerTimeDisplayProps) => {
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const { htmlAudio } = useAudio();
  const isLiveStream = htmlAudio.isLive(duration);

  const formattedCurrentTime = formatDuration(currentTime);
  const formattedRemainingTime = formatDuration(duration - currentTime);
  let timeValue = formattedCurrentTime;
  if (remaining) {
    timeValue = formattedRemainingTime;
  }
  if (isLiveStream && remaining) {
    timeValue = "LIVE";
  }

  const showLiveIcon = isLiveStream && remaining;

  return (
    <time
      className={cn(
        "min-w-12 shrink-0 px-1.5 text-left font-mono text-sm tabular-nums",
        remaining && "text-right",
        showLiveIcon && "flex items-center gap-1 text-red-500 text-xs",
        className
      )}
      data-live={isLiveStream ? "true" : undefined}
      data-remaining={remaining ? "true" : undefined}
      data-slot="audio-time-display"
      {...props}
    >
      {showLiveIcon && (
        <BroadcastIcon className="size-3 shrink-0 animate-pulse" />
      )}
      {timeValue}
    </time>
  );
};

const AudioPlayerSeekBar = ({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof Transport>,
  "value" | "onSeek" | "bufferedValue"
>) => {
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const seek = useAudioStore((state) => state.seek);
  const bufferedTime = useAudioStore((state) => state.bufferedTime);
  const { htmlAudio } = useAudio();
  const isLiveStream = htmlAudio.isLive(duration);

  let progress = 0;
  if (isLiveStream) {
    progress = 100;
  } else if (duration) {
    progress = (currentTime / duration) * 100;
  }

  let bufferedProgress = 0;
  if (isLiveStream) {
    bufferedProgress = 100;
  } else if (duration) {
    bufferedProgress = (bufferedTime / duration) * 100;
  }

  return (
    <Transport
      aria-label="Seek"
      bufferedValue={bufferedProgress}
      className={cn("min-w-20 flex-1", className)}
      disabled={isLiveStream}
      freezeValuesWhileDragging
      onSeek={(nextProgress) => {
        if (!isLiveStream && duration > 0) {
          const newTime = (nextProgress / 100) * duration;
          seek(newTime);
        }
      }}
      value={progress}
      {...props}
    />
  );
};

const AudioPlayerVolume = ({
  className,
  size = "icon",
  variant = "outline",
  ...props
}: Omit<
  React.ComponentProps<typeof Fader>,
  "value" | "onValueChange" | "min" | "max" | "orientation" | "size"
> & {
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) => {
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  const volumePercent = Math.round(volume * 100);
  const effectiveVolumePercent = isMuted ? 0 : volumePercent;

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return SpeakerSlashIcon;
    }
    if (volumePercent < 33) {
      return SpeakerNoneIcon;
    }
    if (volumePercent < 66) {
      return SpeakerLowIcon;
    }
    return SpeakerHighIcon;
  };

  const Icon = getVolumeIcon();

  const handleVolumeChange = React.useCallback(
    (nextVolumePercent: number) => {
      setVolume({ volume: nextVolumePercent / 100 });
    },
    [setVolume]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <AudioPlayerButton
            className={cn("hidden md:flex", className)}
            data-slot="audio-volume-button"
            size={size}
            tooltipLabel={
              isMuted
                ? "Muted"
                : `Volume ${Math.round(effectiveVolumePercent)}%`
            }
            variant={variant}
          />
        }
      >
        <Icon className={cn(isMuted && "opacity-40")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className={cn(
          "flex w-(--dropdown-menu-content-width) flex-col gap-0",
          className
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Volume</span>
            <output className="font-mono text-foreground text-xs tabular-nums">
              {effectiveVolumePercent}
            </output>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem closeOnClick={false}>
            <div className="flex items-center gap-2">
              <AudioPlayerButton
                aria-label={isMuted ? "Unmute" : "Mute"}
                onClick={toggleMute}
                size="icon-sm"
                tooltipLabel={isMuted ? "Unmute" : "Mute"}
                variant="ghost"
              >
                <SpeakerSlashIcon
                  className={cn(
                    "text-primary",
                    isMuted ? "opacity-40" : "opacity-60"
                  )}
                />
              </AudioPlayerButton>

              <Fader
                max={100}
                min={0}
                onValueChange={handleVolumeChange}
                orientation="horizontal"
                size="sm"
                step={1}
                value={effectiveVolumePercent}
                {...props}
              />
              <AudioPlayerButton
                aria-hidden="true"
                aria-readonly
                disabled
                size="icon-sm"
                tooltipLabel="Maximum volume"
                variant="ghost"
              >
                <SpeakerHighIcon
                  aria-hidden="true"
                  className="text-primary opacity-60"
                />
              </AudioPlayerButton>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AudioPlayerPlay = React.memo(
  ({
    className,
    onClick,
    size = "icon",
    variant = "ghost",
    ...props
  }: React.ComponentProps<typeof AudioPlayerButton>) => {
    const isPlaying = useAudioStore((state) => state.isPlaying);
    const isLoading = useAudioStore((state) => state.isLoading);
    const isBuffering = useAudioStore((state) => state.isBuffering);
    const currentTrack = useAudioStore((state) => state.currentTrack);

    const togglePlay = useAudioStore((state) => state.togglePlay);

    const handleKeyPress = React.useCallback(
      (event: KeyboardEvent) => {
        if (event.code === "Space" && event.target === document.body) {
          event.preventDefault();
          togglePlay();
        }
      },
      [togglePlay]
    );

    React.useEffect(() => {
      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }, [handleKeyPress]);

    const showSpinner = isLoading || isBuffering;

    const handleClick = React.useCallback(
      (e: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>) => {
        onClick?.(e);
        togglePlay();
      },
      [onClick, togglePlay]
    );

    return (
      <AudioPlayerButton
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cn(className)}
        data-slot="audio-play-button"
        disabled={showSpinner || !currentTrack}
        onClick={handleClick}
        size={size}
        tooltipLabel={isPlaying ? "Pause" : "Play"}
        variant={variant}
        {...props}
      >
        {showSpinner && <Spinner />}
        {!showSpinner && isPlaying && <PauseIcon weight="fill" />}
        {!(showSpinner || isPlaying) && <PlayIcon weight="fill" />}
      </AudioPlayerButton>
    );
  }
);

const AudioPlayerRewind = React.memo(
  ({
    className,
    onClick,
    size = "icon",
    variant = "ghost",
    ...props
  }: React.ComponentProps<typeof AudioPlayerButton>) => {
    const currentTime = useAudioStore((state) => state.currentTime);
    const duration = useAudioStore((state) => state.duration);
    const seek = useAudioStore((state) => state.seek);
    const currentTrack = useAudioStore((state) => state.currentTrack);
    const { htmlAudio } = useAudio();
    const isLiveStream = htmlAudio.isLive(duration);

    const seekBackward = React.useCallback(
      (seconds = 10) => {
        const newTime = Math.max(currentTime - seconds, 0);
        seek(newTime);
      },
      [currentTime, seek]
    );

    const disableSeekBackward =
      !currentTrack || currentTime <= 0 || isLiveStream;

    return (
      <AudioPlayerButton
        aria-label={isLiveStream ? "Skip backward disabled" : "Skip backward"}
        className={cn(className)}
        data-slot="audio-rewind-button"
        disabled={disableSeekBackward}
        onClick={(e) => {
          onClick?.(e);
          if (!isLiveStream) {
            seekBackward(10);
          }
        }}
        size={size}
        tooltipLabel={
          isLiveStream ? "Not available for live streams" : "Skip backward"
        }
        variant={variant}
        {...props}
      >
        <RewindIcon weight="fill" />
      </AudioPlayerButton>
    );
  }
);

const AudioPlayerFastForward = React.memo(
  ({
    className,
    onClick,
    size = "icon",
    variant = "ghost",
    ...props
  }: React.ComponentProps<typeof AudioPlayerButton>) => {
    const currentTime = useAudioStore((state) => state.currentTime);
    const seek = useAudioStore((state) => state.seek);
    const duration = useAudioStore((state) => state.duration);
    const currentTrack = useAudioStore((state) => state.currentTrack);
    const { htmlAudio } = useAudio();
    const isLiveStream = htmlAudio.isLive(duration);

    const seekForward = React.useCallback(
      (seconds = 10) => {
        const newTime = Math.min(currentTime + seconds, duration);
        seek(newTime);
      },
      [duration, seek, currentTime]
    );

    const disableSeekForward =
      !currentTrack ||
      isLiveStream ||
      (duration > 0 && currentTime >= duration);

    return (
      <AudioPlayerButton
        aria-label={isLiveStream ? "Skip forward disabled" : "Skip forward"}
        className={cn(className)}
        data-slot="audio-fast-forward-button"
        disabled={disableSeekForward}
        onClick={(e) => {
          onClick?.(e);
          if (!isLiveStream) {
            seekForward(10);
          }
        }}
        size={size}
        tooltipLabel={
          isLiveStream ? "Not available for live streams" : "Skip forward"
        }
        variant={variant}
        {...props}
      >
        <FastForwardIcon weight="fill" />
      </AudioPlayerButton>
    );
  }
);

const AudioPlayerSkipForward = React.memo(
  ({
    className,
    onClick,
    size = "icon",
    variant = "ghost",
    ...props
  }: React.ComponentProps<typeof AudioPlayerButton>) => {
    const repeatMode = useAudioStore((state) => state.repeatMode);
    const queueLength = useAudioStore((state) => state.queue.length);
    const currentQueueIndex = useAudioStore((state) => state.currentQueueIndex);
    const currentTrack = useAudioStore((state) => state.currentTrack);

    const next = useAudioStore((state) => state.next);

    const disableNext =
      !currentTrack ||
      (currentQueueIndex === queueLength - 1 && repeatMode !== "all");
    const handleClick = React.useCallback(
      (e: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>) => {
        onClick?.(e);
        next();
      },
      [onClick, next]
    );

    return (
      <AudioPlayerButton
        aria-label="Next"
        className={cn(className)}
        data-slot="audio-skip-forward-button"
        disabled={disableNext}
        onClick={handleClick}
        size={size}
        tooltipLabel="Next"
        variant={variant}
        {...props}
      >
        <SkipForwardIcon weight="fill" />
      </AudioPlayerButton>
    );
  }
);

const AudioPlayerSkipBack = React.memo(
  ({
    className,
    onClick,
    size = "icon",
    variant = "ghost",
    ...props
  }: React.ComponentProps<typeof AudioPlayerButton>) => {
    const repeatMode = useAudioStore((state) => state.repeatMode);
    const currentQueueIndex = useAudioStore((state) => state.currentQueueIndex);
    const currentTrack = useAudioStore((state) => state.currentTrack);

    const previous = useAudioStore((state) => state.previous);

    const disablePrevious =
      !currentTrack || (currentQueueIndex === 0 && repeatMode !== "all");
    const handleClick = React.useCallback(
      (e: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>) => {
        onClick?.(e);
        previous();
      },
      [onClick, previous]
    );

    return (
      <AudioPlayerButton
        aria-label="Previous"
        className={cn(className)}
        data-slot="audio-skip-back-button"
        disabled={disablePrevious}
        onClick={handleClick}
        size={size}
        tooltipLabel="Previous"
        variant={variant}
        {...props}
      >
        <SkipBackIcon weight="fill" />
      </AudioPlayerButton>
    );
  }
);

export {
  AudioPlayerButton,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioPlayerFastForward,
  AudioPlayerPlay,
  AudioPlayerRewind,
  AudioPlayerSeekBar,
  AudioPlayerSkipBack,
  AudioPlayerSkipForward,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
  AudioPlayer,
};
