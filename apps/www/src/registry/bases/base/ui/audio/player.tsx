"use client";

import type { BaseUIEvent } from "@base-ui/react";
import {
  BroadcastIcon,
  FastForwardIcon,
  GaugeIcon,
  MusicNotesIcon,
  PauseIcon,
  PlayIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOnceIcon,
  RewindIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SlidersHorizontalIcon,
  SpeakerHighIcon,
  SpeakerLowIcon,
  SpeakerNoneIcon,
  SpeakerSlashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { useAudio } from "@/registry/bases/base/hooks/use-audio";
import { useAudioStore } from "@/registry/bases/base/lib/audio-store";
import {
  formatDuration,
  type Track,
} from "@/registry/bases/base/lib/html-audio";
import { cn } from "@/registry/bases/base/lib/utils";
import { Fader } from "@/registry/bases/base/ui/audio/elements/fader";
import { Transport } from "@/registry/bases/base/ui/audio/elements/transport";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/registry/bases/base/ui/avatar";
import { Badge } from "@/registry/bases/base/ui/badge";
import { Button, type buttonVariants } from "@/registry/bases/base/ui/button";
import {
  Command,
  CommandInput,
  CommandList,
} from "@/registry/bases/base/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/registry/bases/base/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/bases/base/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/registry/bases/base/ui/item";
import { ScrollArea } from "@/registry/bases/base/ui/scroll-area";
import {
  SortableDragHandle,
  SortableItem,
  SortableList,
} from "@/registry/bases/base/ui/sortable-list";
import { Spinner } from "@/registry/bases/base/ui/spinner";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/base/ui/tooltip";
import { useAudioProvider } from "../../hooks/use-audio-provider";

const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
] as const;

function AudioProvider({
  tracks,
  children,
}: {
  tracks: Track[];
  children: React.ReactNode;
}) {
  useAudioProvider({ tracks });
  return <>{children}</>;
}
const demoTracks: Track[] = [
  {
    id: "1",
    title: "Beautiful Loop",
    artist: "Flavio Concini",
    album: "Pixabay Music",
    url: "https://cdn.pixabay.com/audio/2024/10/21/audio_78251ef8e3.mp3",
    genre: "Upbeat",
  },
  {
    id: "2",
    title: "Type",
    artist: "Aliabbas Abasov",
    album: "Pixabay Music",
    url: "https://cdn.pixabay.com/audio/2024/02/28/audio_60f7a54400.mp3",
    genre: "Hip Hop",
  },
  {
    id: "3",
    title: "Radio Tuxnet",
    artist: "Tuxnet",
    url: "/radio/live.aac?host=ice2.tuxnet.me",
    genre: "Hip Hop",
    artwork: "/icon",
  },
  {
    id: "4",
    title: "Live Radio",
    artist: "Audio UI",
    url: "https://radio.sevalla.app/live.aac",
    artwork: "/icon",
    genre: "Hip Hop",
  },
];

const audioPlayerVariants = cva(
  "before:-z-1 relative w-full before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:backdrop-blur-xl before:backdrop-saturate-150",
  {
    variants: {
      size: {
        sm: "rounded-3xl py-3",
        default: "rounded-4xl py-4",
      },
      variant: {
        default:
          "bg-card/70 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10",
        ghost: "bg-transparent hover:bg-muted/30",
        widget:
          "bg-card/70 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);

type AudioPlayerProps = React.ComponentProps<"div"> &
  VariantProps<typeof audioPlayerVariants> & { tracks?: Track[] };

function AudioPlayer({
  children,
  className,
  tracks,
  size,
  variant,
  ...props
}: AudioPlayerProps) {
  const content = (
    <div
      className={cn(audioPlayerVariants({ size, variant }), className)}
      data-size={size ?? "default"}
      data-slot="audio-player"
      data-variant={variant ?? "default"}
      role="presentation"
      {...props}
    >
      {children}
    </div>
  );

  if (tracks) {
    return <AudioProvider tracks={tracks}>{content}</AudioProvider>;
  }

  return content;
}

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
      data-slot="audio-player-button"
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

const audioControlBarVariants = cva(
  "flex w-full min-w-0 items-center gap-4 in-data-[size=sm]:gap-3 in-data-[size=sm]:px-3 px-4 in-data-[size=sm]:in-data-[variant=widget]:pt-3 in-data-[variant=widget]:pt-4",
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

type AudioPlayerControlBarProps = React.ComponentProps<"div"> &
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

type AudioPlayerControlGroupProps = React.ComponentProps<"div">;

const AudioPlayerControlGroup = ({
  className,
  ...props
}: AudioPlayerControlGroupProps) => (
  <div
    className={cn(
      "flex w-full items-center gap-3 in-data-[size=sm]:gap-2",
      className
    )}
    data-slot="audio-control-group"
    {...props}
  />
);

type AudioPlayerTimeDisplayProps = React.ComponentProps<"time"> & {
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
        "min-w-12 shrink-0 text-left font-mono text-sm tabular-nums",
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
      data-slot="audio-seek-bar"
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

type AudioTrackMediaMode =
  | "cover"
  | "drag-handle"
  | "drag-handle-with-cover"
  | "index";

type AudioTrackActionMode =
  | "none"
  | "play-pause"
  | "remove"
  | "play-pause-with-remove";

type AudioTrackProps = {
  trackId?: string | number;
  track?: Track;
  index?: number;
  onClick?: () => void;
  onRemove?: (trackId: string) => void;
  media?: AudioTrackMediaMode;
  actions?: AudioTrackActionMode;
  className?: string;
} & (
  | { trackId: string | number; track?: never }
  | { track: Track; trackId?: never }
  | { trackId?: never; track?: never }
);

function getPlayPauseTitle(isCurrent: boolean, isPlaying: boolean): string {
  if (!isCurrent) {
    return "Play this track";
  }
  if (isPlaying) {
    return "Pause";
  }
  return "Play";
}

function handleTrackRemoveClick(
  e: React.MouseEvent,
  targetTrackId: string | number | undefined,
  onRemove?: (id: string) => void
) {
  e.stopPropagation();
  e.preventDefault();
  if (targetTrackId !== undefined && onRemove) {
    onRemove(String(targetTrackId));
  }
}

function handleTrackPlayPauseClick(
  e: React.MouseEvent,
  isCurrent: boolean,
  trackId: string | number | undefined,
  queueItems: Track[],
  togglePlay: () => void,
  setQueueAndPlay: (tracks: Track[], index: number) => void
) {
  e.stopPropagation();
  e.preventDefault();

  if (isCurrent) {
    togglePlay();
    return;
  }

  const trackIndex = queueItems.findIndex((t) => t.id === trackId);
  if (trackIndex >= 0) {
    setQueueAndPlay(queueItems, trackIndex);
  }
}

function renderTrackActions({
  actions,
  isCurrent,
  onRemove,
  onTrackRemoveClick,
  onTrackPlayPauseClick,
  playPauseTitle,
  actualIsPlaying,
}: {
  actions: AudioTrackActionMode;
  isCurrent: boolean;
  onRemove?: (trackId: string) => void;
  onTrackRemoveClick: (e: React.MouseEvent) => void;
  onTrackPlayPauseClick: (e: React.MouseEvent) => void;
  playPauseTitle: string;
  actualIsPlaying: boolean;
}) {
  const showRemoveAction =
    (actions === "remove" || actions === "play-pause-with-remove") &&
    !isCurrent &&
    !!onRemove;
  const showPlayPauseAction =
    actions === "play-pause" || actions === "play-pause-with-remove";

  return (
    <>
      {showRemoveAction && (
        <Button
          aria-label="Remove track"
          className="[&_svg]:text-primary"
          onClick={onTrackRemoveClick}
          size="icon-sm"
          title="Remove"
          variant="ghost"
        >
          <XIcon />
        </Button>
      )}
      {showPlayPauseAction && (
        <Button
          aria-label={playPauseTitle}
          className="[&_svg]:text-primary"
          onClick={onTrackPlayPauseClick}
          size="icon-sm"
          title={playPauseTitle}
          variant="ghost"
        >
          {actualIsPlaying ? (
            <PauseIcon weight="fill" />
          ) : (
            <PlayIcon weight="fill" />
          )}
        </Button>
      )}
    </>
  );
}

function renderTrackMedia(
  media: AudioTrackMediaMode,
  track: Track,
  index?: number
) {
  const coverImage = track.artwork || track.images?.[0];
  const cover = coverImage ? (
    <Avatar>
      <AvatarImage alt={track.title} src={coverImage} />
      <AvatarFallback>
        <MusicNotesIcon />
      </AvatarFallback>
    </Avatar>
  ) : (
    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
      <MusicNotesIcon className="size-4 text-muted-foreground" />
    </div>
  );

  switch (media) {
    case "drag-handle-with-cover":
      return (
        <div className="flex items-center gap-2">
          <SortableDragHandle />
          {cover}
        </div>
      );
    case "drag-handle":
      return <SortableDragHandle />;
    case "cover":
      return cover;
    default: {
      const displayIndex = index !== undefined ? index + 1 : "";
      return (
        <span className="text-muted-foreground/60 text-xs">{displayIndex}</span>
      );
    }
  }
}

function AudioTrack({
  trackId,
  track: externalTrack,
  index,
  onClick,
  onRemove,
  media = "cover",
  actions = "play-pause",
  className,
}: AudioTrackProps) {
  const queue = useAudioStore((state) => state.queue);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const duration = useAudioStore((state) => state.duration);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const setQueueAndPlay = useAudioStore((state) => state.setQueueAndPlay);
  const { htmlAudio } = useAudio();

  const track =
    externalTrack ??
    (trackId ? queue.find((t) => String(t.id) === String(trackId)) : undefined);

  if (!track) {
    return null;
  }

  const isCurrent = currentTrack?.id === track.id;
  const actualIsPlaying = isPlaying && isCurrent;
  const trackDuration = isCurrent && duration > 0 ? duration : track.duration;

  const isLiveTrack =
    track.live === true ||
    (trackDuration !== undefined &&
      trackDuration !== null &&
      htmlAudio.isLive(trackDuration));

  const handleRemove = (e: React.MouseEvent) =>
    handleTrackRemoveClick(e, track.id, onRemove);

  const handlePlayPause = (e: React.MouseEvent) =>
    handleTrackPlayPauseClick(
      e,
      isCurrent,
      track.id,
      queue,
      togglePlay,
      setQueueAndPlay
    );
  const playPauseTitle = getPlayPauseTitle(isCurrent, actualIsPlaying);

  return (
    <Item
      className={cn(
        "w-full cursor-pointer backdrop-blur-sm transition-all hover:bg-secondary/50",
        className
      )}
      data-current={isCurrent ? "true" : undefined}
      data-slot="audio-track"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick?.();
      }}
      size="sm"
      variant={isCurrent ? "outline" : "default"}
    >
      <ItemMedia>{renderTrackMedia(media, track, index)}</ItemMedia>
      <ItemContent className="min-w-0 flex-1 gap-0 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <ItemTitle className="line-clamp-1">{track.title}</ItemTitle>
          {isLiveTrack && (
            <Badge variant="destructive">
              <BroadcastIcon weight="fill" />
              Live
            </Badge>
          )}
        </div>
        <ItemDescription className="truncate">{track.artist}</ItemDescription>
      </ItemContent>
      {!isLiveTrack && trackDuration !== undefined && (
        <ItemContent className="flex-none text-center">
          <ItemDescription>{formatDuration(trackDuration)}</ItemDescription>
        </ItemContent>
      )}
      <ItemActions>
        {renderTrackActions({
          actions,
          isCurrent,
          onRemove,
          onTrackRemoveClick: handleRemove,
          onTrackPlayPauseClick: handlePlayPause,
          playPauseTitle,
          actualIsPlaying,
        })}
      </ItemActions>
    </Item>
  );
}

const audioTrackListVariants = cva("w-full", {
  variants: {
    variant: {
      default: "space-y-2",
      grid: "grid grid-cols-1 gap-2 xl:grid-cols-2",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type AudioTrackListProps = {
  tracks?: Track[];
  onTrackSelect?: (index: number, track?: Track) => void;
  onTrackRemove?: (trackId: string) => void;
  mode?: "static" | "sortable";
  media?: "cover" | "index";
  actions?: AudioTrackActionMode;
  emptyLabel?: string;
  emptyDescription?: string;
  filterQuery?: string;
  filterFn?: (track: Track) => boolean;
  className?: string;
} & VariantProps<typeof audioTrackListVariants>;

function AudioTrackList({
  tracks: externalTracks,
  onTrackSelect,
  onTrackRemove,
  mode = "static",
  media = "cover",
  actions,
  variant = "default",
  emptyLabel = "No tracks found",
  emptyDescription = "Try adding some tracks",
  filterQuery,
  filterFn,
  className,
}: AudioTrackListProps) {
  const queue = useAudioStore((state) => state.queue);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const setQueueAndPlay = useAudioStore((state) => state.setQueueAndPlay);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const setQueue = useAudioStore((state) => state.setQueue);
  const currentQueueIndex = useAudioStore((state) => state.currentQueueIndex);

  let tracks = externalTracks ?? queue;

  if (filterFn) {
    tracks = tracks.filter(filterFn);
  } else if (filterQuery?.trim()) {
    const query = filterQuery.toLowerCase();
    tracks = tracks.filter(
      (track: Track) =>
        track.title?.toLowerCase().includes(query) ||
        track.artist?.toLowerCase().includes(query)
    );
  }

  const isFiltered = (filterQuery?.trim().length ?? 0) > 0 || !!filterFn;
  const isExternalTracks = !!externalTracks;
  const resolvedActions: AudioTrackActionMode =
    actions ?? (onTrackRemove ? "play-pause-with-remove" : "play-pause");
  const trackById = React.useMemo(() => {
    const map = new Map<string, Track>();
    for (const track of tracks) {
      if (track.id !== undefined) {
        map.set(String(track.id), track);
      }
    }
    return map;
  }, [tracks]);
  const trackIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    tracks.forEach((track, index) => {
      if (track.id !== undefined) {
        map.set(String(track.id), index);
      }
    });
    return map;
  }, [tracks]);
  const sortableItems = React.useMemo(
    () => Array.from(trackById.keys(), (id) => ({ id })),
    [trackById]
  );

  const handleAutoReorder = (reorderedTracks: Track[]) => {
    if (!(isFiltered || isExternalTracks)) {
      const newIndex =
        currentTrack?.id !== undefined
          ? reorderedTracks.findIndex((t) => t.id === currentTrack.id)
          : -1;

      let finalIndex = 0;
      if (newIndex >= 0) {
        finalIndex = newIndex;
      } else if (
        currentQueueIndex >= 0 &&
        currentQueueIndex < reorderedTracks.length
      ) {
        finalIndex = currentQueueIndex;
      }

      setQueue(reorderedTracks, finalIndex);
    }
  };

  if (tracks.length === 0) {
    return (
      <Empty className={cn(className)}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <QueueIcon />
          </EmptyMedia>
          <EmptyTitle>{emptyLabel}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const renderTrack = (track: Track, index: number, isOverlay = false) => {
    const handleTrackClick = () => {
      if (isExternalTracks) {
        onTrackSelect?.(index, track);
      } else {
        const queueIndex = queue.findIndex((t) => t.id === track.id);
        if (queueIndex >= 0) {
          if (currentTrack?.id === track.id) {
            togglePlay();
          } else {
            setQueueAndPlay(queue, queueIndex);
          }
          const originalTrack = queue[queueIndex];
          onTrackSelect?.(queueIndex, originalTrack);
        } else {
          onTrackSelect?.(index, track);
        }
      }
    };

    if (!track.id) {
      return null;
    }

    let trackMedia: AudioTrackMediaMode = media;
    if (mode === "sortable") {
      trackMedia = media === "cover" ? "drag-handle-with-cover" : "drag-handle";
    }

    return (
      <AudioTrack
        actions={resolvedActions}
        index={index}
        key={track.id}
        media={isOverlay ? media : trackMedia}
        onClick={handleTrackClick}
        onRemove={onTrackRemove}
        track={track}
      />
    );
  };

  const content =
    mode === "sortable" ? (
      <SortableList
        className={
          variant === "grid" ? "grid grid-cols-1 gap-2 xl:grid-cols-2" : "gap-1"
        }
        items={sortableItems}
        onChange={(reorderedTracks) => {
          const reorderedFullTracks = reorderedTracks
            .map((item) => trackById.get(item.id))
            .filter((t): t is Track => t !== undefined);
          handleAutoReorder(reorderedFullTracks);
        }}
        renderItem={(item, index, isOverlay = false) => {
          const track = trackById.get(item.id);
          if (!track?.id) {
            return null;
          }
          const trackIndex = trackIndexById.get(item.id) ?? index;

          const trackContent = renderTrack(track, trackIndex, isOverlay);

          return (
            <SortableItem id={String(track.id)} key={track.id}>
              {trackContent}
            </SortableItem>
          );
        }}
      />
    ) : (
      <div className={cn(audioTrackListVariants({ variant }))}>
        {tracks.map((track, index) => renderTrack(track, index))}
      </div>
    );

  return (
    <ScrollArea
      className={cn(
        "w-full pt-1",
        "in-data-[variant=widget]:h-40 in-data-[variant=widget]:border-b in-data-[variant=widget]:px-4 in-data-[variant=widget]:pb-4",
        "in-data-[size=sm]:in-data-[variant=widget]:h-32 in-data-[size=sm]:in-data-[variant=widget]:px-3 in-data-[size=sm]:in-data-[variant=widget]:pb-3",
        "in-data-[variant=widget]:**:data-[slot=scroll-area-viewport]:snap-y in-data-[variant=widget]:**:data-[slot=scroll-area-viewport]:snap-mandatory",
        "in-data-[variant=widget]:**:data-[slot=audio-track]:snap-start",
        className
      )}
      data-slot="audio-track-list"
    >
      {content}
    </ScrollArea>
  );
}

type AudioQueueProps = {
  onTrackSelect?: (index: number) => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
  emptyDescription?: string;
};

const AudioQueueRepeatMode = ({
  className,
  ...props
}: React.ComponentProps<typeof Toggle>) => {
  const repeatMode = useAudioStore((state) => state.repeatMode);
  const changeRepeatMode = useAudioStore((state) => state.changeRepeatMode);
  const handleRepeat = React.useCallback(() => {
    changeRepeatMode();
  }, [changeRepeatMode]);

  const Icon = repeatMode === "one" ? RepeatOnceIcon : RepeatIcon;
  let repeatTooltip = "Disable repeat";
  if (repeatMode === "one") {
    repeatTooltip = "Repeat this track";
  } else if (repeatMode === "all") {
    repeatTooltip = "Repeat playlist";
  }

  const isPressed = repeatMode !== "none";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label={repeatTooltip}
            className={cn(
              "size-9 [&_svg]:text-primary",
              className,
              isPressed && "bg-accent! text-accent-foreground!"
            )}
            data-slot="audio-queue-repeat-mode"
            onPressedChange={handleRepeat}
            pressed={isPressed}
            {...props}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {repeatTooltip}
      </TooltipContent>
    </Tooltip>
  );
};

const AudioQueueShuffle = ({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Toggle>, "onPressedChange">) => {
  const shuffle = useAudioStore((state) => state.shuffle);
  const unshuffle = useAudioStore((state) => state.unshuffle);
  const shuffleEnabled = useAudioStore((state) => state.shuffleEnabled);

  const handleShuffle = React.useCallback(
    (pressed: boolean) => {
      if (pressed) {
        shuffle();
      } else {
        unshuffle();
      }
    },
    [shuffle, unshuffle]
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label="Shuffle"
            className={cn(
              "size-9 [&_svg]:text-primary",
              className,
              shuffleEnabled && "bg-accent! text-accent-foreground!"
            )}
            data-slot="audio-queue-shuffle"
            onPressedChange={handleShuffle}
            pressed={shuffleEnabled}
            {...props}
          />
        }
      >
        <ShuffleIcon />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        Shuffle {shuffleEnabled ? "on" : "off"}
      </TooltipContent>
    </Tooltip>
  );
};

const AudioQueuePreferences = ({
  className,
  variant = "outline",
  size = "icon",
  tooltipLabel = "Queue preferences",
  ...props
}: React.ComponentProps<typeof AudioPlayerButton>) => {
  const repeatMode = useAudioStore((state) => state.repeatMode);
  const setRepeatMode = useAudioStore((state) => state.setRepeatMode);
  const insertMode = useAudioStore((state) => state.insertMode);
  const setInsertMode = useAudioStore((state) => state.setInsertMode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <AudioPlayerButton
            className={cn(className)}
            data-slot="audio-queue-preferences-trigger"
            size={size}
            tooltipLabel={tooltipLabel}
            variant={variant}
            {...props}
          />
        }
      >
        <SlidersHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(className)}
        data-slot="audio-queue-preferences-content"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Repeat Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(value) => setRepeatMode(value)}
            value={repeatMode}
          >
            <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="one">One</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Insert Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(value) => setInsertMode(value)}
            value={insertMode}
          >
            <DropdownMenuRadioItem value="first">First</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="last">Last</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="after">
              After Current
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AudioQueue = React.memo(
  ({
    onTrackSelect,
    searchPlaceholder = "Search for a track...",
    emptyLabel = "No tracks found",
    emptyDescription = "Try searching for a different track",
  }: AudioQueueProps) => {
    const togglePlay = useAudioStore((state) => state.togglePlay);
    const setQueueAndPlay = useAudioStore((state) => state.setQueueAndPlay);
    const clearQueue = useAudioStore((state) => state.clearQueue);
    const removeFromQueue = useAudioStore((state) => state.removeFromQueue);

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const isFiltered = normalizedSearchQuery.length > 0;

    const handleTrackSelect = React.useCallback(
      (index: number) => {
        const currentState = useAudioStore.getState();
        const currentQueue = currentState.queue;
        const currentTrackId = currentState.currentTrack?.id;
        let filtered = currentQueue;

        if (normalizedSearchQuery) {
          filtered = currentQueue.filter(
            (t: Track) =>
              t.title?.toLowerCase().includes(normalizedSearchQuery) ||
              t.artist?.toLowerCase().includes(normalizedSearchQuery)
          );
        }

        const selectedTrack = filtered[index];
        if (!selectedTrack) {
          return;
        }

        const trackIndex = currentQueue.findIndex(
          (t) => t.id === selectedTrack.id
        );
        if (trackIndex < 0) {
          return;
        }

        if (currentTrackId === selectedTrack.id) {
          togglePlay();
        } else if (currentQueue.length > 0) {
          setQueueAndPlay(currentQueue, trackIndex);
        }
        onTrackSelect?.(trackIndex);
        setDialogOpen(false);
      },
      [normalizedSearchQuery, togglePlay, setQueueAndPlay, onTrackSelect]
    );

    const handleTrackRemove = React.useCallback(
      (trackId: string) => {
        removeFromQueue(trackId);
      },
      [removeFromQueue]
    );

    const handleClearQueue = React.useCallback(() => {
      clearQueue();
    }, [clearQueue]);

    return (
      <Dialog
        onOpenChange={(isOpen) => {
          setDialogOpen(isOpen);
          if (!isOpen) {
            setSearchQuery("");
          }
        }}
        open={dialogOpen}
      >
        <DialogTrigger
          render={
            <AudioPlayerButton
              data-slot="audio-queue-trigger"
              size="icon"
              tooltipLabel="Queue"
              variant="outline"
            />
          }
        >
          <QueueIcon />
        </DialogTrigger>
        <DialogContent
          aria-label="Select a track"
          data-slot="audio-queue"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Audio Queue</DialogTitle>
            <DialogDescription>
              Select a track from the queue to play
            </DialogDescription>
          </DialogHeader>
          <Command
            filter={(value, search, keywords) => {
              const extendValue = `${value} ${keywords?.join(" ") || ""}`;
              if (extendValue.toLowerCase().includes(search.toLowerCase())) {
                return 1;
              }
              return 0;
            }}
          >
            <CommandInput
              onValueChange={setSearchQuery}
              placeholder={searchPlaceholder}
              value={searchQuery}
            />
            <CommandList>
              <AudioTrackList
                emptyDescription={emptyDescription}
                emptyLabel={emptyLabel}
                filterQuery={searchQuery}
                mode={isFiltered ? "static" : "sortable"}
                onTrackRemove={handleTrackRemove}
                onTrackSelect={handleTrackSelect}
              />
            </CommandList>
          </Command>
          <DialogFooter>
            <AudioPlayerButton
              className="w-full"
              onClick={handleClearQueue}
              title="Clear queue"
              variant="destructive"
            >
              Clear
            </AudioPlayerButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

type AudioPlaybackSpeedProps = React.ComponentProps<typeof Button> & {
  speeds?: readonly { value: number; label: string }[];
};

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
          <AudioPlayerButton
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

export {
  audioPlayerVariants,
  AudioProvider,
  demoTracks,
  AudioPlayer,
  AudioPlayerButton,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioPlayerTimeDisplay,
  AudioPlayerSeekBar,
  AudioPlayerVolume,
  AudioPlayerPlay,
  AudioPlayerRewind,
  AudioPlayerFastForward,
  AudioPlayerSkipForward,
  AudioPlayerSkipBack,
  AudioTrack,
  AudioTrackList,
  AudioQueuePreferences,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
  AudioQueue,
  AudioPlaybackSpeed,
};
