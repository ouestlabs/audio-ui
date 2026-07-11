"use client";

import type { BaseUIEvent } from "@base-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
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
import { Spinner } from "@/registry/bases/base/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/base/ui/tooltip";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  SortableDragHandle,
  SortableItem,
  SortableList,
} from "@/registry-audio/bases/base/audio/sortable-list";
import { useAudioProvider } from "@/registry-audio/bases/base/hooks/use-audio-provider";
import {
  type AudioStore,
  useAudioStore,
} from "@/registry-audio/bases/base/lib/audio-store";
import {
  formatDuration,
  type Track,
} from "@/registry-audio/bases/base/lib/html-audio";
import { isLive } from "@/registry-audio/bases/base/lib/playback-engine";

const PLAYBACK_SPEEDS = [
  { label: "0.5x", value: 0.5 },
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
] as const;

type AudioStoreApi = typeof useAudioStore;

const AudioStoreContext = React.createContext<AudioStoreApi | null>(null);

/**
 * Reads the audio store through context so player controls depend on the
 * context interface, not a hard import. Falls back to the global store when
 * used outside an `AudioProvider`, keeping standalone controls working.
 */
function useAudioStoreSelector<T>(selector: (state: AudioStore) => T): T {
  const store = React.use(AudioStoreContext) ?? useAudioStore;
  return store(selector);
}

/** Derives whether the current media is a live stream from its duration. */
function useIsLiveStream(): boolean {
  const duration = useAudioStoreSelector((state) => state.duration);
  return isLive(duration);
}

let spacebarRefCount = 0;
let removeSpacebarListener: (() => void) | null = null;

function useSpacebarTogglePlay() {
  React.useEffect(() => {
    spacebarRefCount += 1;
    if (spacebarRefCount === 1) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.code === "Space" && event.target === document.body) {
          event.preventDefault();
          useAudioStore.getState().togglePlay();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      removeSpacebarListener = () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
    return () => {
      spacebarRefCount -= 1;
      if (spacebarRefCount === 0) {
        removeSpacebarListener?.();
        removeSpacebarListener = null;
      }
    };
  }, []);
}

// Shared glyphs for icons that appear across multiple player controls.
function PlayGlyph() {
  return (
    <IconPlaceholder
      hugeicons="PlayIcon"
      lucide="PlayIcon"
      phosphor="PlayIcon"
      remixicon="RiPlayLine"
      tabler="IconPlayerPlay"
    />
  );
}

function PauseGlyph() {
  return (
    <IconPlaceholder
      hugeicons="PauseIcon"
      lucide="PauseIcon"
      phosphor="PauseIcon"
      remixicon="RiPauseLine"
      tabler="IconPlayerPause"
    />
  );
}

function PlayPauseGlyphSwap({ isPlaying }: { isPlaying: boolean }) {
  return (
    <span className="relative flex items-center justify-center">
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-250 ease-in-out will-change-[opacity,filter,scale] motion-reduce:transition-none",
          isPlaying
            ? "scale-100 opacity-100 blur-0"
            : "scale-[0.25] opacity-0 blur-[2px]"
        )}
      >
        <PauseGlyph />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center transition-[opacity,filter,scale] duration-250 ease-in-out will-change-[opacity,filter,scale] motion-reduce:transition-none",
          isPlaying
            ? "scale-[0.25] opacity-0 blur-[2px]"
            : "scale-100 opacity-100 blur-0"
        )}
      >
        <PlayGlyph />
      </span>
    </span>
  );
}

function MutedGlyph() {
  return (
    <IconPlaceholder
      hugeicons="VolumeOffIcon"
      lucide="VolumeXIcon"
      phosphor="SpeakerSlashIcon"
      remixicon="RiVolumeMuteFill"
      tabler="IconVolumeOff"
    />
  );
}

function AudioProvider({
  tracks,
  children,
}: {
  tracks: Track[];
  children: React.ReactNode;
}) {
  useAudioProvider({ tracks });
  return (
    <AudioStoreContext value={useAudioStore}>{children}</AudioStoreContext>
  );
}
const demoTracks: Track[] = [
  {
    album: "Pixabay Music",
    artist: "Flavio Concini",
    genre: "Upbeat",
    id: "1",
    title: "Beautiful Loop",
    url: "https://cdn.pixabay.com/audio/2024/10/21/audio_78251ef8e3.mp3",
  },
  {
    album: "Pixabay Music",
    artist: "Aliabbas Abasov",
    genre: "Hip Hop",
    id: "2",
    title: "Type",
    url: "https://cdn.pixabay.com/audio/2024/02/28/audio_60f7a54400.mp3",
  },
  {
    artist: "Tuxnet",
    artwork: "/icon",
    genre: "Hip Hop",
    id: "3",
    title: "Radio Tuxnet",
    url: "/radio/live.aac?host=ice2.tuxnet.me",
  },
  {
    artist: "Audio UI",
    artwork: "/icon",
    genre: "Hip Hop",
    id: "4",
    title: "Live Radio",
    url: "https://radio.sevalla.app/live.aac",
  },
];

const audioPlayerVariants = cva(
  "cn-audio-player before:-z-1 relative w-full before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "cn-audio-player-size-default",
        sm: "cn-audio-player-size-sm",
      },
      variant: {
        default: "cn-audio-player-variant-default",
        ghost: "cn-audio-player-variant-ghost",
        widget: "cn-audio-player-variant-widget",
      },
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
      className={cn("cn-audio-player-button", className)}
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
    defaultVariants: {
      variant: "compact",
    },
    variants: {
      variant: {
        compact: "flex-row",
        stacked: "flex-col",
      },
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
  const currentTime = useAudioStoreSelector((state) => state.currentTime);
  const duration = useAudioStoreSelector((state) => state.duration);
  const isLiveStream = useIsLiveStream();

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
        "cn-audio-time-display min-w-12 shrink-0 text-left",
        remaining && "text-right",
        showLiveIcon && "cn-audio-time-display-live flex items-center gap-1",
        className
      )}
      data-live={isLiveStream ? "true" : undefined}
      data-remaining={remaining ? "true" : undefined}
      data-slot="audio-time-display"
      {...props}
    >
      {showLiveIcon && (
        <IconPlaceholder
          className="size-3 shrink-0 animate-pulse"
          hugeicons="RadioIcon"
          lucide="RadioIcon"
          phosphor="BroadcastIcon"
          remixicon="RiBroadcastLine"
          tabler="IconBroadcast"
        />
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
  const currentTime = useAudioStoreSelector((state) => state.currentTime);
  const duration = useAudioStoreSelector((state) => state.duration);
  const seek = useAudioStoreSelector((state) => state.seek);
  const bufferedTime = useAudioStoreSelector((state) => state.bufferedTime);
  const isLiveStream = useIsLiveStream();

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
  const volume = useAudioStoreSelector((state) => state.volume);
  const isMuted = useAudioStoreSelector((state) => state.isMuted);
  const setVolume = useAudioStoreSelector((state) => state.setVolume);
  const toggleMute = useAudioStoreSelector((state) => state.toggleMute);

  const volumePercent = Math.round(volume * 100);
  const effectiveVolumePercent = isMuted ? 0 : volumePercent;

  const renderVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <MutedGlyph />;
    }
    if (volumePercent < 33) {
      return (
        <IconPlaceholder
          hugeicons="VolumeMute02Icon"
          lucide="VolumeIcon"
          phosphor="SpeakerNoneIcon"
          remixicon="RiVolumeMuteLine"
          tabler="IconVolume3"
        />
      );
    }
    if (volumePercent < 66) {
      return (
        <IconPlaceholder
          hugeicons="VolumeLowIcon"
          lucide="Volume1Icon"
          phosphor="SpeakerLowIcon"
          remixicon="RiVolumeDownLine"
          tabler="IconVolume2"
        />
      );
    }
    return (
      <IconPlaceholder
        hugeicons="VolumeHighIcon"
        lucide="Volume2Icon"
        phosphor="SpeakerHighIcon"
        remixicon="RiVolumeUpLine"
        tabler="IconVolume"
      />
    );
  };

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
        <span className={cn(isMuted && "opacity-40")}>
          {renderVolumeIcon()}
        </span>
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
                <span
                  className={cn(
                    "text-primary",
                    isMuted ? "opacity-40" : "opacity-60"
                  )}
                >
                  <MutedGlyph />
                </span>
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
                <IconPlaceholder
                  aria-hidden="true"
                  className="text-primary opacity-60"
                  hugeicons="VolumeHighIcon"
                  lucide="Volume2Icon"
                  phosphor="SpeakerHighIcon"
                  remixicon="RiVolumeUpLine"
                  tabler="IconVolume"
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
    const isPlaying = useAudioStoreSelector((state) => state.isPlaying);
    const isLoading = useAudioStoreSelector((state) => state.isLoading);
    const isBuffering = useAudioStoreSelector((state) => state.isBuffering);
    const currentTrack = useAudioStoreSelector((state) => state.currentTrack);

    const togglePlay = useAudioStoreSelector((state) => state.togglePlay);

    useSpacebarTogglePlay();

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
        {showSpinner ? (
          <Spinner />
        ) : (
          <PlayPauseGlyphSwap isPlaying={isPlaying} />
        )}
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
    const currentTime = useAudioStoreSelector((state) => state.currentTime);
    const seek = useAudioStoreSelector((state) => state.seek);
    const currentTrack = useAudioStoreSelector((state) => state.currentTrack);
    const isLiveStream = useIsLiveStream();

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
        <IconPlaceholder
          hugeicons="BackwardIcon"
          lucide="RewindIcon"
          phosphor="RewindIcon"
          remixicon="RiRewindLine"
          tabler="IconPlayerTrackPrev"
        />
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
    const currentTime = useAudioStoreSelector((state) => state.currentTime);
    const seek = useAudioStoreSelector((state) => state.seek);
    const duration = useAudioStoreSelector((state) => state.duration);
    const currentTrack = useAudioStoreSelector((state) => state.currentTrack);
    const isLiveStream = useIsLiveStream();

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
        <IconPlaceholder
          hugeicons="FastForwardIcon"
          lucide="FastForwardIcon"
          phosphor="FastForwardIcon"
          remixicon="RiSpeedUpLine"
          tabler="IconPlayerTrackNext"
        />
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
    const repeatMode = useAudioStoreSelector((state) => state.repeatMode);
    const queueLength = useAudioStoreSelector((state) => state.queue.length);
    const currentQueueIndex = useAudioStoreSelector(
      (state) => state.currentQueueIndex
    );
    const currentTrack = useAudioStoreSelector((state) => state.currentTrack);

    const next = useAudioStoreSelector((state) => state.next);

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
        <IconPlaceholder
          hugeicons="NextIcon"
          lucide="SkipForwardIcon"
          phosphor="SkipForwardIcon"
          remixicon="RiSkipForwardLine"
          tabler="IconPlayerSkipForward"
        />
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
    const repeatMode = useAudioStoreSelector((state) => state.repeatMode);
    const currentQueueIndex = useAudioStoreSelector(
      (state) => state.currentQueueIndex
    );
    const currentTrack = useAudioStoreSelector((state) => state.currentTrack);

    const previous = useAudioStoreSelector((state) => state.previous);

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
        <IconPlaceholder
          hugeicons="PreviousIcon"
          lucide="SkipBackIcon"
          phosphor="SkipBackIcon"
          remixicon="RiSkipBackLine"
          tabler="IconPlayerSkipBack"
        />
      </AudioPlayerButton>
    );
  }
);

type AudioTrackActionMode =
  | "none"
  | "play-pause"
  | "remove"
  | "play-pause-with-remove";

type AudioTrackContextValue = {
  track: Track;
  index?: number;
  isCurrent: boolean;
  isPlaying: boolean;
  trackDuration?: number;
  onTogglePlayPause: (e: React.MouseEvent) => void;
  onRemove?: (e: React.MouseEvent) => void;
};

const AudioTrackContext = React.createContext<AudioTrackContextValue | null>(
  null
);

function useAudioTrackContext() {
  const context = React.use(AudioTrackContext);
  if (!context) {
    throw new Error(
      "AudioTrack subcomponents must be rendered within <AudioTrack>"
    );
  }
  return context;
}

type AudioTrackProps = {
  trackId?: string | number;
  track?: Track;
  index?: number;
  onClick?: () => void;
  onRemove?: (trackId: string) => void;
  media?: React.ReactNode;
  actions?: React.ReactNode;
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

function AudioTrack({
  trackId,
  track: externalTrack,
  index,
  onClick,
  onRemove,
  media,
  actions,
  className,
}: AudioTrackProps) {
  const queue = useAudioStoreSelector((state) => state.queue);
  const currentTrack = useAudioStoreSelector((state) => state.currentTrack);
  const isPlaying = useAudioStoreSelector((state) => state.isPlaying);
  const duration = useAudioStoreSelector((state) => state.duration);
  const togglePlay = useAudioStoreSelector((state) => state.togglePlay);
  const setQueueAndPlay = useAudioStoreSelector(
    (state) => state.setQueueAndPlay
  );

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
      isLive(trackDuration));

  const contextValue: AudioTrackContextValue = {
    index,
    isCurrent,
    isPlaying: actualIsPlaying,
    onRemove: onRemove
      ? (e) => handleTrackRemoveClick(e, track.id, onRemove)
      : undefined,
    onTogglePlayPause: (e) =>
      handleTrackPlayPauseClick(
        e,
        isCurrent,
        track.id,
        queue,
        togglePlay,
        setQueueAndPlay
      ),
    track,
    trackDuration,
  };

  return (
    <AudioTrackContext value={contextValue}>
      <Item
        className={cn(
          "cn-audio-track w-full cursor-pointer transition-colors",
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
        {media && <ItemMedia className="gap-2">{media}</ItemMedia>}
        <ItemContent className="min-w-0 flex-1 gap-0 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <ItemTitle className="line-clamp-1">{track.title}</ItemTitle>
            {isLiveTrack && (
              <Badge variant="destructive">
                <IconPlaceholder
                  hugeicons="RadioIcon"
                  lucide="RadioIcon"
                  phosphor="BroadcastIcon"
                  remixicon="RiBroadcastLine"
                  tabler="IconBroadcast"
                />
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
        {actions && <ItemActions>{actions}</ItemActions>}
      </Item>
    </AudioTrackContext>
  );
}

function AudioTrackCover({ className }: { className?: string }) {
  const { track } = useAudioTrackContext();
  const coverImage = track.artwork || track.images?.[0];

  if (!coverImage) {
    return (
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full bg-muted",
          className
        )}
      >
        <IconPlaceholder
          className="size-4 text-muted-foreground"
          hugeicons="MusicNote01Icon"
          lucide="MusicIcon"
          phosphor="MusicNotesIcon"
          remixicon="RiMusic2Line"
          tabler="IconMusic"
        />
      </div>
    );
  }

  return (
    <Avatar className={className}>
      <AvatarImage alt={track.title} src={coverImage} />
      <AvatarFallback>
        <IconPlaceholder
          hugeicons="MusicNote01Icon"
          lucide="MusicIcon"
          phosphor="MusicNotesIcon"
          remixicon="RiMusic2Line"
          tabler="IconMusic"
        />
      </AvatarFallback>
    </Avatar>
  );
}

function AudioTrackIndex({ className }: { className?: string }) {
  const { index } = useAudioTrackContext();
  const displayIndex = index === undefined ? "" : index + 1;

  return (
    <span className={cn("text-muted-foreground/60 text-xs", className)}>
      {displayIndex}
    </span>
  );
}

function AudioTrackPlayPauseAction({ className }: { className?: string }) {
  const { isCurrent, isPlaying, onTogglePlayPause } = useAudioTrackContext();
  const title = getPlayPauseTitle(isCurrent, isPlaying);

  return (
    <Button
      aria-label={title}
      className={cn("[&_svg]:text-primary", className)}
      onClick={onTogglePlayPause}
      size="icon-sm"
      title={title}
      variant="ghost"
    >
      <PlayPauseGlyphSwap isPlaying={isPlaying} />
    </Button>
  );
}

function AudioTrackRemoveAction({ className }: { className?: string }) {
  const { isCurrent, onRemove } = useAudioTrackContext();

  if (isCurrent || !onRemove) {
    return null;
  }

  return (
    <Button
      aria-label="Remove track"
      className={cn("[&_svg]:text-primary", className)}
      onClick={onRemove}
      size="icon-sm"
      title="Remove"
      variant="ghost"
    >
      <IconPlaceholder
        hugeicons="Cancel01Icon"
        lucide="XIcon"
        phosphor="XIcon"
        remixicon="RiCloseLine"
        tabler="IconX"
      />
    </Button>
  );
}

function resolveTrackMedia(
  media: "cover" | "index",
  isSortable: boolean,
  isOverlay: boolean
): React.ReactNode {
  if (isOverlay || !isSortable) {
    return media === "index" ? <AudioTrackIndex /> : <AudioTrackCover />;
  }
  return (
    <>
      <SortableDragHandle />
      {media === "cover" && <AudioTrackCover />}
    </>
  );
}

function resolveTrackActions(
  actionMode: AudioTrackActionMode
): React.ReactNode {
  switch (actionMode) {
    case "none":
      return null;
    case "remove":
      return <AudioTrackRemoveAction />;
    case "play-pause-with-remove":
      return (
        <>
          <AudioTrackRemoveAction />
          <AudioTrackPlayPauseAction />
        </>
      );
    default:
      return <AudioTrackPlayPauseAction />;
  }
}

const audioTrackListVariants = cva("w-full", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "flex flex-col gap-2",
      grid: "grid grid-cols-1 gap-2 xl:grid-cols-2",
    },
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
  const queue = useAudioStoreSelector((state) => state.queue);
  const currentTrack = useAudioStoreSelector((state) => state.currentTrack);
  const setQueueAndPlay = useAudioStoreSelector(
    (state) => state.setQueueAndPlay
  );
  const togglePlay = useAudioStoreSelector((state) => state.togglePlay);
  const setQueue = useAudioStoreSelector((state) => state.setQueue);
  const currentQueueIndex = useAudioStoreSelector(
    (state) => state.currentQueueIndex
  );

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
        currentTrack?.id === undefined
          ? -1
          : reorderedTracks.findIndex((t) => t.id === currentTrack.id);

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
            <IconPlaceholder
              hugeicons="PlayListIcon"
              lucide="ListMusicIcon"
              phosphor="QueueIcon"
              remixicon="RiPlayList2Line"
              tabler="IconPlaylist"
            />
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

    return (
      <AudioTrack
        actions={resolveTrackActions(resolvedActions)}
        index={index}
        key={track.id}
        media={resolveTrackMedia(media, mode === "sortable", isOverlay)}
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
    <div
      className={cn(
        "no-scrollbar scroll-fade-y w-full overflow-y-auto pt-1",
        "in-data-[variant=widget]:h-40 in-data-[variant=widget]:px-4 in-data-[variant=widget]:pb-4",
        "in-data-[size=sm]:in-data-[variant=widget]:h-32 in-data-[size=sm]:in-data-[variant=widget]:px-3 in-data-[size=sm]:in-data-[variant=widget]:pb-3",
        "in-data-[variant=widget]:snap-y in-data-[variant=widget]:snap-mandatory",
        "in-data-[variant=widget]:**:data-[slot=audio-track]:snap-start",
        className
      )}
      data-slot="audio-track-list"
    >
      {content}
    </div>
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
}: React.ComponentProps<typeof AudioPlayerButton>) => {
  const repeatMode = useAudioStoreSelector((state) => state.repeatMode);
  const changeRepeatMode = useAudioStoreSelector(
    (state) => state.changeRepeatMode
  );

  let repeatTooltip = "Disable repeat";
  if (repeatMode === "one") {
    repeatTooltip = "Repeat this track";
  } else if (repeatMode === "all") {
    repeatTooltip = "Repeat playlist";
  }

  const isActive = repeatMode !== "none";

  return (
    <AudioPlayerButton
      aria-label={repeatTooltip}
      aria-pressed={isActive}
      className={className}
      data-slot="audio-queue-repeat-mode"
      onClick={() => changeRepeatMode()}
      size="icon"
      tooltipLabel={repeatTooltip}
      variant={isActive ? "secondary" : "ghost"}
      {...props}
    >
      {repeatMode === "one" ? (
        <IconPlaceholder
          hugeicons="RepeatOne01Icon"
          lucide="Repeat1Icon"
          phosphor="RepeatOnceIcon"
          remixicon="RiRepeatOneLine"
          tabler="IconRepeatOnce"
        />
      ) : (
        <IconPlaceholder
          hugeicons="RepeatIcon"
          lucide="RepeatIcon"
          phosphor="RepeatIcon"
          remixicon="RiRepeat2Line"
          tabler="IconRepeat"
        />
      )}
    </AudioPlayerButton>
  );
};

const AudioQueueShuffle = ({
  className,
  ...props
}: React.ComponentProps<typeof AudioPlayerButton>) => {
  const shuffle = useAudioStoreSelector((state) => state.shuffle);
  const unshuffle = useAudioStoreSelector((state) => state.unshuffle);
  const shuffleEnabled = useAudioStoreSelector((state) => state.shuffleEnabled);

  const handleShuffle = React.useCallback(() => {
    if (shuffleEnabled) {
      unshuffle();
    } else {
      shuffle();
    }
  }, [shuffleEnabled, shuffle, unshuffle]);

  const shuffleTooltip = `Shuffle ${shuffleEnabled ? "on" : "off"}`;

  return (
    <AudioPlayerButton
      aria-label={shuffleTooltip}
      aria-pressed={shuffleEnabled}
      className={className}
      data-slot="audio-queue-shuffle"
      onClick={handleShuffle}
      size="icon"
      tooltipLabel={shuffleTooltip}
      variant={shuffleEnabled ? "secondary" : "ghost"}
      {...props}
    >
      <IconPlaceholder
        hugeicons="ShuffleIcon"
        lucide="ShuffleIcon"
        phosphor="ShuffleIcon"
        remixicon="RiShuffleLine"
        tabler="IconArrowsShuffle"
      />
    </AudioPlayerButton>
  );
};

const AudioQueuePreferences = ({
  className,
  variant = "outline",
  size = "icon",
  tooltipLabel = "Queue preferences",
  ...props
}: React.ComponentProps<typeof AudioPlayerButton>) => {
  const repeatMode = useAudioStoreSelector((state) => state.repeatMode);
  const setRepeatMode = useAudioStoreSelector((state) => state.setRepeatMode);
  const insertMode = useAudioStoreSelector((state) => state.insertMode);
  const setInsertMode = useAudioStoreSelector((state) => state.setInsertMode);

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
        <IconPlaceholder
          hugeicons="Settings02Icon"
          lucide="SlidersHorizontalIcon"
          phosphor="SlidersHorizontalIcon"
          remixicon="RiEqualizer2Line"
          tabler="IconAdjustmentsHorizontal"
        />
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
    const togglePlay = useAudioStoreSelector((state) => state.togglePlay);
    const setQueueAndPlay = useAudioStoreSelector(
      (state) => state.setQueueAndPlay
    );
    const clearQueue = useAudioStoreSelector((state) => state.clearQueue);
    const removeFromQueue = useAudioStoreSelector(
      (state) => state.removeFromQueue
    );
    const store = React.use(AudioStoreContext) ?? useAudioStore;

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const isFiltered = normalizedSearchQuery.length > 0;

    const handleTrackSelect = React.useCallback(
      (index: number) => {
        const currentState = store.getState();
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
      [normalizedSearchQuery, togglePlay, setQueueAndPlay, onTrackSelect, store]
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
          <IconPlaceholder
            hugeicons="Playlist03Icon"
            lucide="ListMusicIcon"
            phosphor="QueueIcon"
            remixicon="RiPlayList2Line"
            tabler="IconPlaylist"
          />
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
  const playbackRate = useAudioStoreSelector((state) => state.playbackRate);
  const setPlaybackRate = useAudioStoreSelector(
    (state) => state.setPlaybackRate
  );
  const isLiveStream = useIsLiveStream();

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
        {!isIconSize && (
          <IconPlaceholder
            hugeicons="DashboardSpeed01Icon"
            lucide="GaugeIcon"
            phosphor="GaugeIcon"
            remixicon="RiSpeedLine"
            tabler="IconGauge"
          />
        )}
        <span
          className="starting:blur-[2px] starting:opacity-0 starting:translate-y-1 inline-block font-mono text-xs transition-[opacity,filter,translate] duration-150 ease-in-out will-change-[opacity,filter,translate] motion-reduce:transition-none"
          key={displayLabel}
        >
          {displayLabel}
        </span>
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
  AudioPlaybackSpeed,
  AudioPlayer,
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
  AudioProvider,
  AudioQueue,
  AudioQueuePreferences,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
  AudioTrack,
  AudioTrackCover,
  AudioTrackIndex,
  AudioTrackList,
  AudioTrackPlayPauseAction,
  AudioTrackRemoveAction,
  audioPlayerVariants,
  demoTracks,
};
