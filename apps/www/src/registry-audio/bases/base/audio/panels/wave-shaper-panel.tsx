"use client";

import { useCallback, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { WaveformSelect } from "@/registry-audio/bases/base/audio/elements/waveform-select";
import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type WaveShaperNote,
  type WaveShaperState,
  waveShaperDevice,
  waveShaperPitch,
  waveShaperResonance,
} from "@/registry-audio/bases/base/lib/wave-shaper-device";

const PAD_MAX = 100;
/** The knobs under the pad: the wave is the row of buttons. */
const [WAVE] = waveShaperDevice.parameters;
const NOT_KNOBS = ["wave"] as const;

const formatPad = (position: { x: number; y: number }) => (
  <>
    <span>{Math.round(waveShaperPitch(position.x / PAD_MAX))}Hz</span>
    <span>, Q: {waveShaperResonance(position.y / PAD_MAX).toFixed(1)}</span>
  </>
);

interface WaveShaperPanelProps {
  className?: string;
  /** The pad is let go. */
  onNoteOff?: () => void;
  /** A note is played: called as the pad is pressed and again as it moves. */
  onNoteOn?: (note: WaveShaperNote) => void;
  onValueChange: (state: WaveShaperState) => void;
  value: WaveShaperState;
}

/**
 * The face of the Wave Shaper device: a pad that plays it (pitch across,
 * filter resonance up), its waveform, and its knobs. It is controlled like
 * `DevicePanel`: the state is `value`, and the notes leave through `onNoteOn`
 * and `onNoteOff`, so it plays through whatever engine a host gives it, or
 * none. It takes the height it is given: the pad grows to fill it.
 */
function WaveShaperPanel({
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: WaveShaperPanelProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const move = useCallback(
    (next: { x: number; y: number }) => {
      setPosition(next);
      onNoteOn?.({
        frequency: waveShaperPitch(next.x / PAD_MAX),
        resonance: waveShaperResonance(next.y / PAD_MAX),
      });
    },
    [onNoteOn]
  );
  const pickWave = useCallback(
    (wave: string) => onValueChange(waveShaperDevice.set(value, "wave", wave)),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={waveShaperDevice}
        onValueChange={onValueChange}
        value={value}
      />
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="wave-shaper-panel"
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
        <DevicePanel
          className="grid-cols-5"
          device={waveShaperDevice}
          exclude={NOT_KNOBS}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { WaveShaperPanel };
