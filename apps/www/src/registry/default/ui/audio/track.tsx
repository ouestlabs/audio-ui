"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  ListMusicIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  RadioIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useAudio } from "@/registry/default/hooks/use-audio";
import { useAudioStore } from "@/registry/default/lib/audio-store";
import { formatDuration, type Track } from "@/registry/default/lib/html-audio";
import { cn } from "@/registry/default/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/registry/default/ui/avatar";
import { Badge } from "@/registry/default/ui/badge";
import { Button } from "@/registry/default/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/default/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/registry/default/ui/item";
import { ScrollArea } from "@/registry/default/ui/scroll-area";
import {
  SortableDragHandle,
  SortableItem,
  SortableList,
} from "@/registry/default/ui/sortable-list";

/**
 * Props for the AudioTrack component.
 * Supports two modes: store mode (using trackId) or controlled mode (using track).
 */
export type AudioTrackMediaMode =
  | "cover"
  | "drag-handle"
  | "drag-handle-with-cover"
  | "index";

export type AudioTrackActionMode =
  | "none"
  | "play-pause"
  | "remove"
  | "play-pause-with-remove";

export type AudioTrackProps = {
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
          className="[&_svg.fill-current]:fill-primary [&_svg]:text-primary"
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
          className="[&_svg.fill-current]:fill-primary [&_svg]:text-primary"
          onClick={onTrackPlayPauseClick}
          size="icon-sm"
          title={playPauseTitle}
          variant="ghost"
        >
          {actualIsPlaying ? (
            <PauseIcon className="size-4 fill-current" />
          ) : (
            <PlayIcon className="size-4 fill-current" />
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
    <Avatar className="rounded-sm">
      <AvatarImage
        alt={track.title}
        className="object-cover"
        src={coverImage}
      />
      <AvatarFallback className="rounded-sm">
        <MusicIcon className="size-4 text-muted-foreground" />
      </AvatarFallback>
    </Avatar>
  ) : (
    <div className="flex size-10 items-center justify-center rounded-sm bg-muted">
      <MusicIcon className="size-4 text-muted-foreground" />
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
        "w-full cursor-pointer transition-all hover:bg-secondary/50",
        isCurrent && "bg-secondary/80 backdrop-blur-sm",
        className
      )}
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
          <ItemTitle className="truncate font-medium text-sm">
            {track.title}
          </ItemTitle>
          {isLiveTrack && (
            <Badge className="bg-destructive/10 px-1 py-0.5 font-medium text-[10px] text-destructive uppercase leading-none">
              <RadioIcon className="size-2.5" />
              Live
            </Badge>
          )}
        </div>
        <ItemDescription className="text-xs">{track.artist}</ItemDescription>
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

AudioTrack.displayName = "AudioTrack";

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

/**
 * Props for the AudioTrackList component.
 * Can operate in store mode (reads from global queue) or controlled mode (uses provided tracks).
 */
export type AudioTrackListProps = {
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
      <Empty className={cn("mx-auto size-full border bg-muted/30", className)}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListMusicIcon />
          </EmptyMedia>
          <EmptyTitle>{emptyLabel}</EmptyTitle>
          <EmptyDescription className="text-xs/relaxed">
            {emptyDescription}
          </EmptyDescription>
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
      className={cn("w-full scroll-pt-2 scroll-pb-1.5 pt-1", className)}
    >
      {content}
    </ScrollArea>
  );
}

export { AudioTrack, AudioTrackList };
