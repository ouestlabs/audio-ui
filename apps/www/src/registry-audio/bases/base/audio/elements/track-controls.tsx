"use client";

import { type MouseEvent, useCallback } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/registry/bases/base/ui/context-menu";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { TimelineTrackResizeHandle } from "@/registry-audio/bases/base/audio/elements/timeline";

export const MIN_TRACK_HEIGHT = 28;
/** Below this a track is a strip: its header keeps the name, solo and mute, and the gain goes. */
export const COMPACT_TRACK_HEIGHT = 52;
export const MAX_TRACK_HEIGHT = 240;
export const TRACK_HEIGHT_STEP = 8;

/** The colors a track can take: the theme's chart tokens, written out for the stylesheet to find. */
export const TRACK_COLORS = [
  {
    dot: "bg-chart-1",
    clip: "[--primary:var(--chart-1)]",
    edge: "border-s-chart-1",
    name: "Color 1",
  },
  {
    dot: "bg-chart-2",
    clip: "[--primary:var(--chart-2)]",
    edge: "border-s-chart-2",
    name: "Color 2",
  },
  {
    dot: "bg-chart-3",
    clip: "[--primary:var(--chart-3)]",
    edge: "border-s-chart-3",
    name: "Color 3",
  },
  {
    dot: "bg-chart-4",
    clip: "[--primary:var(--chart-4)]",
    edge: "border-s-chart-4",
    name: "Color 4",
  },
  {
    dot: "bg-chart-5",
    clip: "[--primary:var(--chart-5)]",
    edge: "border-s-chart-5",
    name: "Color 5",
  },
] as const;

const formatPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) {
    return "C";
  }
  return `${pan < 0 ? "L" : "R"}${amount}`;
};

/** What a track's header sets: how loud it is, and whether it is silenced or soloed. */
export interface Mix {
  /** An index into `TRACK_COLORS`. */
  color: number;
  gain: number;
  muted: boolean;
  pan: number;
  soloed: boolean;
}

export const UNITY_MIX: Mix = {
  color: 0,
  gain: 1,
  muted: false,
  pan: 0,
  soloed: false,
};

/**
 * What a track's header holds: its name, which selects the track (its content
 * is where the cursor goes), solo, mute and gain. The lower edge resizes it.
 */
function TimelineTrackControls({
  compact,
  mix,
  name,
  onMix,
  onSelect,
  selected,
  trackId,
}: {
  /** Whether the track is short: one row, with no gain. */
  compact: boolean;
  mix: Mix;
  name: string;
  onMix: (trackId: string, patch: Partial<Mix>) => void;
  onSelect: (trackId: string) => void;
  selected: boolean;
  trackId: string;
}) {
  const handleMute = useCallback(
    () => onMix(trackId, { muted: !mix.muted }),
    [mix.muted, onMix, trackId]
  );
  const handleSolo = useCallback(
    () => onMix(trackId, { soloed: !mix.soloed }),
    [mix.soloed, onMix, trackId]
  );
  const handleGain = useCallback(
    (value: number | readonly number[]) =>
      onMix(trackId, { gain: Array.isArray(value) ? value[0] : Number(value) }),
    [onMix, trackId]
  );
  const handlePan = useCallback(
    (value: number | readonly number[]) =>
      onMix(trackId, { pan: Array.isArray(value) ? value[0] : Number(value) }),
    [onMix, trackId]
  );
  const handleColor = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      onMix(trackId, { color: Number(event.currentTarget.dataset.color) }),
    [onMix, trackId]
  );
  const handleClick = useCallback(() => onSelect(trackId), [onSelect, trackId]);
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            className={cn(
              "relative flex w-full flex-col justify-center border-s-4 px-2",
              compact ? "py-0" : "gap-1 py-1.5",
              TRACK_COLORS[mix.color]?.edge
            )}
          />
        }
      >
        <div className="flex items-center gap-1">
          <button
            aria-pressed={selected}
            className="min-w-0 flex-1 truncate text-left font-medium outline-none hover:underline focus-visible:underline"
            onClick={handleClick}
            type="button"
          >
            {name}
          </button>
          <Button
            aria-label={`Solo ${name}`}
            aria-pressed={mix.soloed}
            onClick={handleSolo}
            size="icon-xs"
            variant={mix.soloed ? "default" : "ghost"}
          >
            <IconPlaceholder
              hugeicons="HeadphonesIcon"
              lucide="HeadphonesIcon"
              phosphor="HeadphonesIcon"
              remixicon="RiHeadphoneLine"
              tabler="IconHeadphones"
            />
          </Button>
          <Button
            aria-label={`Mute ${name}`}
            aria-pressed={mix.muted}
            onClick={handleMute}
            size="icon-xs"
            variant={mix.muted ? "default" : "ghost"}
          >
            {mix.muted ? (
              <IconPlaceholder
                hugeicons="VolumeMute01Icon"
                lucide="VolumeXIcon"
                phosphor="SpeakerSimpleSlashIcon"
                remixicon="RiVolumeMuteLine"
                tabler="IconVolumeOff"
              />
            ) : (
              <IconPlaceholder
                hugeicons="VolumeHighIcon"
                lucide="Volume2Icon"
                phosphor="SpeakerSimpleHighIcon"
                remixicon="RiVolumeUpLine"
                tabler="IconVolume"
              />
            )}
          </Button>
        </div>
        {compact ? null : (
          <div className="flex h-7 items-center gap-5 pe-1">
            <Fader
              aria-label={`${name} gain`}
              className="min-w-0 flex-1 **:data-[orientation=horizontal]:min-w-0"
              editableValue
              max={1}
              min={0}
              onValueChange={handleGain}
              orientation="horizontal"
              size="sm"
              step={0.01}
              thumbMarks={false}
              value={mix.gain}
              valueLabel="auto"
            />
            <Knob
              anchor={0}
              aria-label={`${name} pan`}
              className="mb-0 size-7 shrink-0"
              editableValue
              formatValue={formatPan}
              max={1}
              min={-1}
              onValueChange={handlePan}
              size="sm"
              step={0.01}
              value={mix.pan}
            />
          </div>
        )}
        <TimelineTrackResizeHandle aria-label={`${name} height`} />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-36">
        {TRACK_COLORS.map((swatch, index) => (
          <ContextMenuItem
            data-color={index}
            key={swatch.name}
            onClick={handleColor}
          >
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-full", swatch.dot)}
            />
            {swatch.name}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export { TimelineTrackControls };
