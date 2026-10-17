"use client";

import type { Waveform as WaveformPrimitive } from "@audio-ui/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import {
  Waveform,
  WaveformHover,
  WaveformMarker,
  WaveformRegion,
  WaveformRegionHandle,
} from "@/registry-audio/bases/base/audio/elements/waveform";

/** What the panel sets on a clip. Times are in the source's own time, from its start. */
export interface ClipSettings {
  /** In dB. */
  gain: number;
  /** How long the clip plays. */
  length: number;
  /** The stretch of the source that repeats, or null when the clip plays it once. */
  loop: readonly [number, number] | null;
  /** Where in the source the clip starts playing. */
  offset: number;
  reversed: boolean;
  /** How long the source is. */
  sourceLength: number;
  /** In semitones. */
  transpose: number;
}

interface ClipPanelProps {
  /** Whatever the host puts at the end of the title bar. */
  children?: ReactNode;
  className?: string;
  /** How a time in the source reads, in the hover and the handles. @default seconds with two decimals */
  format?: (seconds: number) => string;
  /** The clip's name, the panel's title. */
  name: string;
  /** Crop was pressed: cut the source down to what the clip plays. Leave it out for a panel without it. */
  onCrop?: () => void;
  /** Every change, as a gesture goes. */
  onValueChange: (value: ClipSettings) => void;
  /** A gesture that changed the settings ended. */
  onValueCommitted?: () => void;
  value: ClipSettings;
  /** The source's peaks, the shape the waveform draws. */
  values: WaveformPrimitive.Root.Peaks;
}

const formatSeconds = (seconds: number) => `${seconds.toFixed(2)} s`;

/** The peaks in the other order: a list of amplitudes, or a `{ min, max }` pair of them. */
function backwards(
  values: WaveformPrimitive.Root.Peaks
): WaveformPrimitive.Root.Peaks {
  if ("length" in values) {
    return Array.from(values).reverse();
  }
  return {
    max: Array.from(values.max).reverse(),
    min: Array.from(values.min).reverse(),
  };
}
const formatGain = (db: number) => `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
const formatTranspose = (semitones: number) =>
  `${semitones > 0 ? "+" : ""}${semitones} st`;

/**
 * The clip view of an arrangement's clip: its whole source as a waveform,
 * with the stretch it plays to drag at both ends, or with Loop on, the
 * stretch that repeats, and its start as a marker. Gain and Transpose are
 * knobs, Reverse plays the source backwards and Crop cuts it down to what is
 * played. Controlled: it reports every change and the end of each gesture.
 */
function ClipPanel({
  children,
  className,
  format = formatSeconds,
  name,
  onCrop,
  onValueChange,
  onValueCommitted,
  value,
  values,
}: ClipPanelProps) {
  const { gain, length, loop, offset, reversed, sourceLength, transpose } =
    value;
  // Reversed, the source is drawn backwards, as it plays.
  const shown = useMemo(
    () => (reversed ? backwards(values) : values),
    [reversed, values]
  );
  const set = useCallback(
    (patch: Partial<ClipSettings>) => onValueChange({ ...value, ...patch }),
    [onValueChange, value]
  );
  const setAndCommit = useCallback(
    (patch: Partial<ClipSettings>) => {
      set(patch);
      onValueCommitted?.();
    },
    [onValueCommitted, set]
  );
  const setPlayed = useCallback(
    ([start, end]: readonly [number, number]) =>
      set({ length: end - start, offset: start }),
    [set]
  );
  const setLoop = useCallback(
    (next: readonly [number, number]) => set({ loop: next }),
    [set]
  );
  // A loop begins on what the clip plays; switched off, the clip plays once, as far as its source goes.
  const toggleLoop = useCallback(
    () =>
      setAndCommit(
        loop
          ? { length: Math.min(length, sourceLength - offset), loop: null }
          : {
              loop: [offset, offset + Math.min(length, sourceLength - offset)],
            }
      ),
    [length, loop, offset, setAndCommit, sourceLength]
  );
  const toggleReversed = useCallback(
    () => setAndCommit({ reversed: !reversed }),
    [reversed, setAndCommit]
  );
  const setGain = useCallback((next: number) => set({ gain: next }), [set]);
  const setTranspose = useCallback(
    (next: number) => set({ transpose: next }),
    [set]
  );
  const cropped = loop
    ? loop[0] === 0 && loop[1] === sourceLength
    : offset === 0 && length >= sourceLength;

  return (
    <section
      aria-label={`Clip ${name}`}
      className={cn(
        "flex min-w-0 shrink-0 flex-col gap-3 rounded-xl border bg-card p-3",
        className
      )}
      data-slot="clip-panel"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-medium text-sm">{name}</h3>
        <Button
          aria-pressed={Boolean(loop)}
          onClick={toggleLoop}
          size="sm"
          variant={loop ? "default" : "outline"}
        >
          <IconPlaceholder
            aria-hidden="true"
            className="size-4"
            hugeicons="RepeatIcon"
            lucide="RepeatIcon"
            phosphor="RepeatIcon"
            remixicon="RiRepeatLine"
            tabler="IconRepeat"
          />
          Loop
        </Button>
        <Button
          aria-pressed={reversed}
          onClick={toggleReversed}
          size="sm"
          variant={reversed ? "default" : "outline"}
        >
          <IconPlaceholder
            aria-hidden="true"
            className="size-4"
            hugeicons="ArrowLeftDoubleIcon"
            lucide="RewindIcon"
            phosphor="RewindIcon"
            remixicon="RiRewindLine"
            tabler="IconPlayerTrackPrev"
          />
          Reverse
        </Button>
        {onCrop ? (
          <Button
            disabled={cropped}
            onClick={onCrop}
            size="sm"
            variant="outline"
          >
            <IconPlaceholder
              aria-hidden="true"
              className="size-4"
              hugeicons="Crop02Icon"
              lucide="CropIcon"
              phosphor="CropIcon"
              remixicon="RiCropLine"
              tabler="IconCrop"
            />
            Crop
          </Button>
        ) : null}
        {children}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <Waveform
          aria-label={`${name} source`}
          className="h-24 w-full min-w-0"
          duration={sourceLength}
          values={shown}
        >
          {loop ? (
            <>
              <WaveformRegion
                aria-label="Loop"
                onValueChange={setLoop}
                onValueCommitted={onValueCommitted}
                value={loop}
              >
                <WaveformRegionHandle
                  aria-label="Loop start"
                  edge="start"
                  getAriaValueText={format}
                />
                <WaveformRegionHandle
                  aria-label="Loop end"
                  edge="end"
                  getAriaValueText={format}
                />
              </WaveformRegion>
              <WaveformMarker value={offset}>Start</WaveformMarker>
            </>
          ) : (
            <WaveformRegion
              aria-label="Played"
              onValueChange={setPlayed}
              onValueCommitted={onValueCommitted}
              value={[offset, Math.min(sourceLength, offset + length)]}
            >
              <WaveformRegionHandle
                aria-label="Clip start"
                edge="start"
                getAriaValueText={format}
              />
              <WaveformRegionHandle
                aria-label="Clip end"
                edge="end"
                getAriaValueText={format}
              />
            </WaveformRegion>
          )}
          <WaveformHover format={format} />
        </Waveform>
        {/* Each knob named above and read out below, as on a device. */}
        <div className="flex items-start gap-6">
          <div className="flex flex-col items-center gap-0.5">
            <span aria-hidden="true" className="text-muted-foreground text-xs">
              Gain
            </span>
            <Knob
              anchor={0}
              aria-label="Gain"
              className="mb-5"
              formatValue={formatGain}
              max={24}
              min={-36}
              onValueChange={setGain}
              onValueCommitted={onValueCommitted}
              size="sm"
              step={0.1}
              value={gain}
              valueLabel="always"
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span aria-hidden="true" className="text-muted-foreground text-xs">
              Transpose
            </span>
            <Knob
              anchor={0}
              aria-label="Transpose"
              className="mb-5"
              formatValue={formatTranspose}
              max={48}
              min={-48}
              onValueChange={setTranspose}
              onValueCommitted={onValueCommitted}
              size="sm"
              step={1}
              value={transpose}
              valueLabel="always"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export { ClipPanel };
