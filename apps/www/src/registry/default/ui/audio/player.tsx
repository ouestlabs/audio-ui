"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  FastForwardIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  RadioIcon,
  RewindIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeIcon,
  VolumeXIcon,
} from "lucide-react";
import React from "react";
import { useAudio } from "@/registry/default/hooks/use-audio";
import { useAudioStore } from "@/registry/default/lib/audio-store";
import { formatDuration } from "@/registry/default/lib/html-audio";
import { cn } from "@/registry/default/lib/utils";
import { Button, type buttonVariants } from "@/registry/default/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/registry/default/ui/dropdown-menu";
import { Slider } from "@/registry/default/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

interface AudioPlayerButtonProps extends React.ComponentProps<typeof Button> {
  tooltip?: boolean;
  tooltipLabel?: string;
}

function AudioPlayerButton({
  tooltip = false,
  tooltipLabel,
  ...props
}: AudioPlayerButtonProps) {
  const button = <Button {...props} />;

  if (tooltip && tooltipLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
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
        "w-full rounded-(--radius) border bg-card p-1.5",
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
  const { currentTime, duration } = useAudioStore();
  const { htmlAudio } = useAudio();
  const isLiveStream = htmlAudio.isLive(duration);

  const formattedCurrentTime = React.useMemo(
    () => formatDuration(currentTime),
    [currentTime]
  );

  const formattedRemainingTime = React.useMemo(
    () => formatDuration(duration - currentTime),
    [duration, currentTime]
  );

  const timeValue = React.useMemo(() => {
    if (isLiveStream && remaining) {
      return "LIVE";
    }

    if (isLiveStream && !remaining) {
      return formattedCurrentTime;
    }

    return remaining ? formattedRemainingTime : formattedCurrentTime;
  }, [isLiveStream, remaining, formattedCurrentTime, formattedRemainingTime]);

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
      {showLiveIcon && <RadioIcon className="size-3 animate-pulse" />}
      {timeValue}
    </time>
  );
};

const AudioPlayerSeekBar = ({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof Slider>,
  "value" | "onValueChange" | "min" | "max" | "bufferValue"
>) => {
  const { currentTime, duration, seek, bufferedTime } = useAudioStore();
  const { htmlAudio } = useAudio();
  const isLiveStream = htmlAudio.isLive(duration);

  const progress = React.useMemo(() => {
    if (isLiveStream) {
      return 100;
    }
    if (!duration) {
      return 0;
    }
    return (currentTime / duration) * 100;
  }, [isLiveStream, currentTime, duration]);

  const bufferedProgress = React.useMemo(() => {
    if (isLiveStream) {
      return 100;
    }
    if (!duration) {
      return 0;
    }
    return (bufferedTime / duration) * 100;
  }, [isLiveStream, bufferedTime, duration]);

  const handleSeek = (e: React.MouseEvent | React.TouchEvent) => {
    if (isLiveStream || !duration) {
      return;
    }

    const target = e.currentTarget;
    let clientX: number;

    if ("touches" in e) {
      clientX = e.touches[0]?.clientX ?? 0;
    } else {
      clientX = e.clientX;
    }

    const rect = target.getBoundingClientRect();
    const position = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width)
    );
    seek(position * duration);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isLiveStream) {
      handleSeek(e);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isLiveStream) {
      e.preventDefault();
      handleSeek(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isLiveStream && e.buttons === 1) {
      handleSeek(e);
    }
  };

  return (
    <Slider
      bufferValue={bufferedProgress}
      className={cn("min-w-20 flex-1", className)}
      disabled={isLiveStream}
      max={100}
      min={0}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onValueChange={(value) => {
        if (!isLiveStream && value?.[0] !== undefined && duration > 0) {
          const newTime = (value[0] / 100) * duration;
          seek(newTime);
        }
      }}
      value={[progress]}
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
  React.ComponentProps<typeof Slider>,
  "value" | "onValueChange" | "min" | "max"
> & {
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) => {
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  const volumePercent = Math.round(volume * 100);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return VolumeXIcon;
    }
    if (volumePercent < 33) {
      return VolumeIcon;
    }
    if (volumePercent < 66) {
      return Volume1Icon;
    }
    return Volume2Icon;
  };

  const Icon = getVolumeIcon();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AudioPlayerButton
          className={cn("hidden md:flex", className)}
          data-slot="audio-volume-button"
          size={size}
          tooltip
          tooltipLabel={
            isMuted ? "Muted" : `Volume ${Math.round(volumePercent)}%`
          }
          variant={variant}
        >
          <Icon className={cn(isMuted && "opacity-40", "text-primary")} />
        </AudioPlayerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn("flex w-48 flex-col gap-1.5 p-1.5", className)}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm">Volume</span>
          <span className="font-mono text-sm tabular-nums">
            {volumePercent}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <VolumeXIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 cursor-pointer",
              isMuted ? "opacity-40" : "opacity-60"
            )}
            onClick={toggleMute}
            role="button"
          />
          <Slider
            className={cn(className)}
            max={100}
            min={0}
            onValueChange={(value) => {
              if (value?.[0] !== undefined) {
                setVolume({ volume: value[0] / 100 });
                if (value[0] === 0) {
                  toggleMute();
                } else if (isMuted) {
                  toggleMute();
                }
              }
            }}
            value={[volumePercent]}
            {...props}
          />
          <Volume2Icon
            aria-hidden="true"
            className="size-4 shrink-0 opacity-60"
          />
        </div>
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
      (e: React.MouseEvent<HTMLButtonElement>) => {
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
        tooltip
        tooltipLabel={isPlaying ? "Pause" : "Play"}
        variant={variant}
        {...props}
      >
        {showSpinner && <Loader2Icon className="animate-spin" />}
        {!showSpinner && isPlaying && <PauseIcon fill="currentColor" />}
        {!(showSpinner || isPlaying) && <PlayIcon fill="currentColor" />}
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

    const disableSeekBackward = React.useMemo(
      () => !currentTrack || currentTime <= 0 || isLiveStream,
      [currentTrack, currentTime, isLiveStream]
    );

    return (
      <AudioPlayerButton
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
        tooltip
        tooltipLabel={
          isLiveStream ? "Not available for live streams" : "Skip backward"
        }
        variant={variant}
        {...props}
      >
        <RewindIcon fill="currentColor" />
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

    const disableSeekForward = React.useMemo(() => {
      if (!currentTrack || isLiveStream) {
        return true;
      }
      return duration > 0 && currentTime >= duration;
    }, [currentTrack, currentTime, duration, isLiveStream]);

    return (
      <AudioPlayerButton
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
        tooltip
        tooltipLabel={
          isLiveStream ? "Not available for live streams" : "Skip forward"
        }
        variant={variant}
        {...props}
      >
        <FastForwardIcon fill="currentColor" />
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

    const disableNext = React.useMemo(
      () =>
        !currentTrack ||
        (currentQueueIndex === queueLength - 1 && repeatMode !== "all"),
      [currentTrack, currentQueueIndex, queueLength, repeatMode]
    );

    return (
      <AudioPlayerButton
        aria-label="Next"
        className={cn(className)}
        data-slot="audio-skip-forward-button"
        disabled={disableNext}
        onClick={next}
        size={size}
        tooltip
        tooltipLabel="Next"
        variant={variant}
        {...props}
      >
        <SkipForwardIcon fill="currentColor" />
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

    const disablePrevious = React.useMemo(
      () => !currentTrack || (currentQueueIndex === 0 && repeatMode !== "all"),
      [currentTrack, currentQueueIndex, repeatMode]
    );

    return (
      <AudioPlayerButton
        className={cn(className)}
        data-slot="audio-skip-back-button"
        disabled={disablePrevious}
        onClick={previous}
        size={size}
        tooltip
        tooltipLabel="Previous"
        variant={variant}
        {...props}
      >
        <SkipBackIcon fill="currentColor" />
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
