"use client";

import { type ReactNode, useCallback, useId, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";
import {
  type PocketSynthNote,
  type PocketSynthState,
  pocketSynthCutoff,
  pocketSynthDevice,
  pocketSynthPitch,
} from "@/registry-audio/bases/base/lib/pocket-synth-device";

/** Graduations along the fader: ticks only, the readout beside it says the value. */
const VOLUME_MARKS = [0, 0.25, 0.5, 0.75, 1];
const PAD_MAX = 100;

const WAVE_PATHS: Record<string, string> = {
  sawtooth: "M2 18l8-12v12l8-12v12",
  sine: "M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0",
  square: "M2 18h4V6h6v12h4V6h6",
  triangle: "M2 12l5-6 5 12 5-12 5 6",
};

/** The two-letter names the filter buttons carry. */
const FILTER_SHORT: Record<string, string> = {
  allpass: "AP",
  bandpass: "BP",
  highpass: "HP",
  lowpass: "LP",
};

const [WAVE, FILTER] = pocketSynthDevice.parameters;

function WaveIcon({ label, wave }: { label: string; wave: string }) {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <title>{label}</title>
      <path d={WAVE_PATHS[wave]} />
    </svg>
  );
}

const formatPad = (position: { x: number; y: number }): ReactNode => (
  <>
    <span>{Math.round(pocketSynthPitch(position.x / PAD_MAX))}Hz</span>
    <span>, </span>
    <span>{Math.round(pocketSynthCutoff(position.y / PAD_MAX))}Hz</span>
  </>
);

interface PocketSynthPanelProps {
  className?: string;
  /** The pad is let go. */
  onNoteOff?: () => void;
  /** A note is played: called as the pad is pressed and again as it moves. */
  onNoteOn?: (note: PocketSynthNote) => void;
  onValueChange: (state: PocketSynthState) => void;
  value: PocketSynthState;
}

/**
 * The face of the Pocket Synth device: a pad that plays it (pitch across,
 * filter cutoff up), its waveform and filter, and its volume. It is controlled
 * like `DevicePanel`: the state is `value`, and the notes leave through
 * `onNoteOn` and `onNoteOff`, so it plays through whatever engine a host
 * gives it, or none. It takes the height it is given: the pad grows to fill it.
 */
function PocketSynthPanel({
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: PocketSynthPanelProps) {
  const faderId = useId();
  const faderLabelId = useId();
  const faderValueId = useId();
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const move = useCallback(
    (next: { x: number; y: number }) => {
      setPosition(next);
      onNoteOn?.({
        cutoff: pocketSynthCutoff(next.y / PAD_MAX),
        frequency: pocketSynthPitch(next.x / PAD_MAX),
      });
    },
    [onNoteOn]
  );
  const pickWave = useCallback(
    (values: unknown[]) =>
      onValueChange(pocketSynthDevice.set(value, "wave", values[0])),
    [onValueChange, value]
  );
  const pickFilter = useCallback(
    (values: unknown[]) =>
      onValueChange(pocketSynthDevice.set(value, "filter", values[0])),
    [onValueChange, value]
  );
  const setVolume = useCallback(
    (volume: number) =>
      onValueChange(pocketSynthDevice.set(value, "volume", volume)),
    [onValueChange, value]
  );

  return (
    <div
      className={cn("flex h-full w-full min-w-0 flex-col gap-4", className)}
      data-slot="pocket-synth-panel"
    >
      <XYPad
        aria-label="Tone"
        fill
        formatValue={formatPad}
        maxX={PAD_MAX}
        maxY={PAD_MAX}
        minX={0}
        minY={0}
        onValueChange={move}
        onValueCommitted={onNoteOff}
        value={position}
      />
      <ToggleGroup
        aria-label={WAVE.label}
        className="w-full"
        onValueChange={pickWave}
        size="sm"
        value={[value.wave]}
        variant="outline"
      >
        {WAVE.options.map((option) => (
          <ToggleGroupItem
            aria-label={`${option.label} wave`}
            className="flex-1"
            key={option.value}
            value={option.value}
          >
            <WaveIcon label={`${option.label} wave`} wave={option.value} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ToggleGroup
        aria-label={FILTER.label}
        className="w-full"
        onValueChange={pickFilter}
        size="sm"
        value={[value.filter]}
        variant="outline"
      >
        {FILTER.options.map((option) => (
          <ToggleGroupItem
            aria-label={option.label}
            className="flex-1"
            key={option.value}
            value={option.value}
          >
            {FILTER_SHORT[option.value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div aria-label="Volume" role="group">
        <div className="flex w-full min-w-0 items-center justify-between gap-4 [&>*:not(output):not(span)]:min-w-0 [&>*:not(output):not(span)]:flex-1">
          <span
            className="text-center text-muted-foreground text-xs"
            id={faderLabelId}
          >
            Volume
          </span>
          <Fader
            aria-describedby={faderValueId}
            aria-labelledby={faderLabelId}
            id={faderId}
            marks={VOLUME_MARKS}
            max={1}
            min={0}
            onValueChange={setVolume}
            orientation="horizontal"
            step={0.01}
            value={value.volume}
            valueLabel="hidden"
          />
          <output
            aria-live="polite"
            className="min-w-12 text-center font-mono text-muted-foreground text-xs tabular-nums"
            id={faderValueId}
          >
            {pocketSynthDevice.format("volume", value.volume)}
          </output>
        </div>
      </div>
    </div>
  );
}

export { PocketSynthPanel };
