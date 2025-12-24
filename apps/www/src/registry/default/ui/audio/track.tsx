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
import type React from "react";
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
export type AudioTrackProps = {
  trackId?: string | number;
  track?: Track;
  index?: number;
  onClick?: () => void;
  onRemove?: (trackId: string) => void;
  showRemove?: boolean;
  showPlayPause?: boolean;
  showDragHandle?: boolean;
  showCover?: boolean;
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

function renderTrackMedia(
  showDragHandle: boolean,
  showCover: boolean,
  track: Track,
  index?: number
) {
  if (showDragHandle && showCover) {
    const coverImage = track.artwork || track.images?.[0];
    return (
      <div className="flex items-center gap-2">
        <SortableDragHandle />
        {coverImage ? (
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
        )}
      </div>
    );
  }

  if (showDragHandle) {
    return <SortableDragHandle />;
  }

  if (showCover) {
    const coverImage = track.artwork || track.images?.[0];
    if (coverImage) {
      return (
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
      );
    }
    return (
      <div className="flex size-10 items-center justify-center rounded-sm bg-muted">
        <MusicIcon className="size-4 text-muted-foreground" />
      </div>
    );
  }

  const displayIndex = index !== undefined ? index + 1 : "";
  return (
    <span className="text-muted-foreground/60 text-xs">{displayIndex}</span>
  );
}

function AudioTrack({
  trackId,
  track: externalTrack,
  index,
  onClick,
  onRemove,
  showRemove = false,
  showPlayPause = true,
  showDragHandle = false,
  showCover = true,
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

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (track.id && onRemove) {
      onRemove(String(track.id));
    }
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isCurrent) {
      togglePlay();
    } else {
      const trackIndex = queue.findIndex((t) => t.id === track.id);
      if (trackIndex >= 0) {
        setQueueAndPlay(queue, trackIndex);
      }
    }
  };

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
      <ItemMedia>
        {renderTrackMedia(showDragHandle, showCover, track, index)}
      </ItemMedia>
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
        {showRemove && !isCurrent && onRemove && (
          <Button
            onClick={handleRemove}
            size="icon-sm"
            title="Remove"
            variant="ghost"
          >
            <XIcon />
          </Button>
        )}
        {showPlayPause && (
          <Button
            onClick={handlePlayPause}
            size="icon-sm"
            title={getPlayPauseTitle(isCurrent, actualIsPlaying)}
            variant="ghost"
          >
            {actualIsPlaying ? (
              <PauseIcon className="size-4 fill-current" />
            ) : (
              <PlayIcon className="size-4 fill-current" />
            )}
          </Button>
        )}
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
  sortable?: boolean;
  showCover?: boolean;
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
  sortable = false,
  showCover = true,
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

    const showDragHandle = sortable && !isOverlay;

    return (
      <AudioTrack
        index={index}
        key={track.id}
        onClick={handleTrackClick}
        onRemove={onTrackRemove}
        showCover={showCover}
        showDragHandle={showDragHandle}
        showRemove={!!onTrackRemove}
        track={track}
      />
    );
  };

  const content = sortable ? (
    <SortableList
      className={
        variant === "grid" ? "grid grid-cols-1 gap-2 xl:grid-cols-2" : "gap-1"
      }
      items={tracks
        .filter((t) => t.id !== undefined)
        .map((t) => ({ id: String(t.id) }))}
      onChange={(reorderedTracks) => {
        const reorderedTrackIds = reorderedTracks.map((t) => t.id);
        const reorderedFullTracks = reorderedTrackIds
          .map((id) => tracks.find((t) => String(t.id) === id))
          .filter((t): t is Track => t !== undefined);
        handleAutoReorder(reorderedFullTracks);
      }}
      renderItem={(item, index, isOverlay = false) => {
        const track = tracks.find((t) => String(t.id) === item.id);
        if (!track?.id) {
          return null;
        }
        const originalIndex = tracks.findIndex((t) => t.id === track.id);
        const trackIndex = originalIndex >= 0 ? originalIndex : index;

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
