"use client";

import {
  QueueIcon,
  RepeatIcon,
  RepeatOnceIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import type { ComponentProps } from "react";
import React from "react";
import { useAudioStore } from "@/registry/default/lib/audio-store";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/registry/default/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
  tooltipLabel?: string;
}

function AudioQueueButton({
  tooltipLabel,
  className,
  children,
  ...props
}: AudioQueueButtonProps) {
  const buttonProps = {
    ...props,
    className: cn("[&_svg]:text-primary", className),
    "aria-label": props["aria-label"] ?? tooltipLabel,
  };

  if (tooltipLabel) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Button {...buttonProps} />}>
          {children}
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>{tooltipLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return <Button {...buttonProps}>{children}</Button>;
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
              "[&_svg]:text-primary",
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

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label="Shuffle"
            className={cn(
              "[&_svg]:text-primary",
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
}: React.ComponentProps<typeof AudioQueueButton>) => {
  const repeatMode = useAudioStore((state) => state.repeatMode);
  const setRepeatMode = useAudioStore((state) => state.setRepeatMode);
  const insertMode = useAudioStore((state) => state.insertMode);
  const setInsertMode = useAudioStore((state) => state.setInsertMode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <AudioQueueButton
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
            <AudioQueueButton
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
          <DialogHeader>
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
            <AudioQueueButton
              className="w-full"
              onClick={handleClearQueue}
              title="Clear queue"
              variant="destructive"
            >
              Clear
            </AudioQueueButton>
          </DialogFooter>
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
