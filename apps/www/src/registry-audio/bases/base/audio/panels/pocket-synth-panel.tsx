"use client";

import { type ReactNode, useCallback, useId, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { WaveformSelect } from "@/registry-audio/bases/base/audio/elements/waveform-select";
import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";
import {
  DeviceFrame,
  DeviceHeader,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
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

/** The two-letter names the filter buttons carry. */
const FILTER_SHORT: Record<string, string> = {
  allpass: "AP",
  bandpass: "BP",
  highpass: "HP",
  lowpass: "LP",
};

const [WAVE, FILTER] = pocketSynthDevice.parameters;

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
    (wave: string) => onValueChange(pocketSynthDevice.set(value, "wave", wave)),
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
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={pocketSynthDevice}
        onValueChange={onValueChange}
        value={value}
      />
      <div
        className="flex min-h-0 grow flex-col gap-4 p-3"
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
        <WaveformSelect
          aria-label={WAVE.label}
          onValueChange={pickWave}
          options={WAVE.options}
          value={value.wave}
        />
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
    </DeviceFrame>
  );
}

export { PocketSynthPanel };
