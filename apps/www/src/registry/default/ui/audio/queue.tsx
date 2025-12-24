"use client";

import {
  ListMusicIcon,
  Repeat1Icon,
  RepeatIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import React from "react";
import {
  type InsertMode,
  type RepeatMode,
  useAudioStore,
} from "@/registry/default/lib/audio-store";
import type { Track } from "@/registry/default/lib/html-audio";
import { cn } from "@/registry/default/lib/utils";
import { AudioTrackList } from "@/registry/default/ui/audio/track";
import { Button } from "@/registry/default/ui/button";
import {
  Command,
  CommandInput,
  CommandList,
} from "@/registry/default/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/registry/default/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/registry/default/ui/dropdown-menu";
import { Toggle } from "@/registry/default/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

/**
 * Props for the AudioQueueButton component.
 */
export interface AudioQueueButtonProps extends ComponentProps<typeof Button> {
  tooltip?: boolean;
  tooltipLabel?: string;
}

function AudioQueueButton({
  tooltip = false,
  tooltipLabel,
  ...props
}: AudioQueueButtonProps) {
  if (tooltip && tooltipLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button {...props} />
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>{tooltipLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return <Button {...props} />;
}

const AudioQueueRepeatMode = ({
  className,
  ...props
}: ComponentProps<typeof Toggle>) => {
  const repeatMode = useAudioStore((state) => state.repeatMode);
  const changeRepeatMode = useAudioStore((state) => state.changeRepeatMode);
  const handleRepeat = React.useCallback(() => {
    changeRepeatMode();
  }, [changeRepeatMode]);

  const Icon = repeatMode === "one" ? Repeat1Icon : RepeatIcon;
  let repeatTooltip = "Disable repeat";
  if (repeatMode === "one") {
    repeatTooltip = "Repeat this track";
  } else if (repeatMode === "all") {
    repeatTooltip = "Repeat playlist";
  }

  const isPressed = repeatMode !== "none";

  const toggle = (
    <Toggle
      className={cn(
        className,
        isPressed && "bg-accent! text-accent-foreground!"
      )}
      data-slot="audio-queue-repeat-mode"
      onPressedChange={handleRepeat}
      pressed={isPressed}
      {...props}
    >
      <Icon className="size-4" />
    </Toggle>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{toggle}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {repeatTooltip}
      </TooltipContent>
    </Tooltip>
  );
};

const AudioQueueShuffle = ({
  className,
  ...props
}: Omit<ComponentProps<typeof Toggle>, "onPressedChange">) => {
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

  const toggle = (
    <Toggle
      aria-label="Shuffle"
      className={cn(
        className,
        shuffleEnabled && "bg-accent! text-accent-foreground!"
      )}
      data-slot="audio-queue-shuffle"
      onPressedChange={handleShuffle}
      pressed={shuffleEnabled}
      {...props}
    >
      <ShuffleIcon className="size-4" />
    </Toggle>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{toggle}</TooltipTrigger>
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
  tooltip = true,
  tooltipLabel = "Queue preferences",
  ...props
}: React.ComponentProps<typeof AudioQueueButton>) => {
  const repeatMode = useAudioStore((state) => state.repeatMode);
  const setRepeatMode = useAudioStore((state) => state.setRepeatMode);
  const insertMode = useAudioStore((state) => state.insertMode);
  const setInsertMode = useAudioStore((state) => state.setInsertMode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AudioQueueButton
          className={cn(className)}
          data-slot="audio-queue-preferences-trigger"
          size={size}
          tooltip
          tooltipLabel={tooltipLabel}
          variant={variant}
          {...props}
        >
          <SlidersHorizontalIcon className="size-4" />
        </AudioQueueButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("w-45", className)}
        data-slot="audio-queue-preferences-content"
      >
        <DropdownMenuLabel className="text-muted-foreground">
          Repeat Mode
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => setRepeatMode(value as RepeatMode)}
          value={repeatMode}
        >
          <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="one">One</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuLabel className="text-muted-foreground">
          Insert Mode
        </DropdownMenuLabel>

        <DropdownMenuRadioGroup
          onValueChange={(value) => setInsertMode(value as InsertMode)}
          value={insertMode}
        >
          <DropdownMenuRadioItem value="first">First</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="last">Last</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="after">
            After Current
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Props for the AudioQueue component.
 */
export type AudioQueueProps = {
  onTrackSelect?: (index: number) => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
  emptyDescription?: string;
};

const AudioQueue = React.memo(
  ({
    onTrackSelect,
    searchPlaceholder = "Search for a track...",
    emptyLabel = "No tracks found",
    emptyDescription = "Try searching for a different track",
  }: AudioQueueProps) => {
    const togglePlay = useAudioStore((state) => state.togglePlay);
    const currentTrackId = useAudioStore((state) => state.currentTrack?.id);
    const setQueueAndPlay = useAudioStore((state) => state.setQueueAndPlay);
    const clearQueue = useAudioStore((state) => state.clearQueue);
    const removeFromQueue = useAudioStore((state) => state.removeFromQueue);

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");

    const isFiltered = searchQuery.trim().length > 0;

    const handleTrackSelect = React.useCallback(
      (index: number) => {
        const currentQueue = useAudioStore.getState().queue;
        let filtered = currentQueue;

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = currentQueue.filter(
            (t: Track) =>
              t.title?.toLowerCase().includes(query) ||
              t.artist?.toLowerCase().includes(query)
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
      [searchQuery, currentTrackId, togglePlay, setQueueAndPlay, onTrackSelect]
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
        <DialogTrigger asChild>
          <AudioQueueButton
            size="icon"
            tooltip
            tooltipLabel="Queue"
            variant="outline"
          >
            <ListMusicIcon />
          </AudioQueueButton>
        </DialogTrigger>
        <DialogContent
          aria-label="Select a track"
          className="rounded-xl border-none bg-clip-padding p-2 pb-11 shadow-2xl ring-4 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800"
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
            className="rounded-none bg-transparent **:data-[slot=command-input-wrapper]:mb-0 **:data-[slot=command-input-wrapper]:h-9! **:data-[slot=command-input]:h-9! **:data-[slot=command-input-wrapper]:rounded-md **:data-[slot=command-input-wrapper]:border **:data-[slot=command-input-wrapper]:border-input **:data-[slot=command-input-wrapper]:bg-input/50 **:data-[slot=command-input]:py-0"
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
            <CommandList className="pt-2 pb-1">
              <AudioTrackList
                className="mx-0"
                emptyDescription={emptyDescription}
                emptyLabel={emptyLabel}
                filterQuery={searchQuery}
                onTrackRemove={handleTrackRemove}
                onTrackSelect={handleTrackSelect}
                sortable={!isFiltered}
              />
            </CommandList>
          </Command>
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 rounded-b-xl border-t border-t-neutral-100 bg-neutral-50 p-1 font-medium text-muted-foreground text-xs dark:border-t-neutral-700 dark:bg-neutral-800">
            <AudioQueueButton
              className="w-full"
              onClick={handleClearQueue}
              size="sm"
              title="Clear queue"
              variant="destructive"
            >
              <TrashIcon className="size-4" /> Clear
            </AudioQueueButton>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
export {
  AudioQueue,
  AudioQueueButton,
  AudioQueuePreferences,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
};
