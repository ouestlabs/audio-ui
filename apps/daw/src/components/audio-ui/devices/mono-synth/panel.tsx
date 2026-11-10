"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
import { SawtoothIcon, SquareIcon, TriangleIcon } from "@audio-ui/icons/react";
import { type ReactNode, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Piano } from "@/components/audio-ui/piano";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  MONO_SYNTH_PRESETS,
  type MonoSynthNote,
  type MonoSynthState,
  monoSynthDevice,
  monoSynthPreset,
} from "@/components/audio-ui/devices/mono-synth/device";

/** The controls by what they do, as the synth's panel lays them out. */
const GROUPS = [
  {
    label: "Oscillators",
    parameters: ["tune", "osc", "width", "sub", "noise"],
  },
  { label: "Filter", parameters: ["cutoff", "resonance", "contour"] },
  { label: "Envelope", parameters: ["attack", "decay", "sustain", "release"] },
  { label: "Pitch", parameters: ["glide", "rate", "depth"] },
  { label: "Output", parameters: ["volume"] },
] as const;

/** What the title bar holds, next to the presets: the oscillator's wave and the range of the keyboard. */
const HEADER_CONTROLS = ["wave", "range"] as const;
const RANGE = monoSynthDevice.parameters.find(
  (parameter) => parameter.id === "range"
) as Extract<(typeof monoSynthDevice.parameters)[number], { id: "range" }>;
/** The pulse width shapes the square only. */
const NOT_SQUARE = ["width"] as const;
const NONE = [] as const;

const PRESET_NAMES = MONO_SYNTH_PRESETS.map((preset) => ({
  label: preset.name,
  value: preset.name,
}));

/** The keyboard's two octaves, from C3: the range moves them. */
const LOWEST = 48;
const HIGHEST = 72;

interface MonoSynthPanelProps {
  /** The notes held now, such as on a MIDI keyboard: their keys light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is played, as a note of the synth. */
  onNoteOn?: (note: MonoSynthNote) => void;
  onValueChange: (state: MonoSynthState) => void;
  value: MonoSynthState;
}

/**
 * The face of the Mono Synth device: its eight sounds to start from, the
 * oscillator's wave and the range in its title bar, its controls by what they
 * do (the oscillators, the filter, the envelope, the glide and the vibrato),
 * and a keyboard that plays it. Controlled like `DevicePanel`: the state is
 * `value`, and a key leaves through `onNoteOn` and `onNoteOff`, so it plays
 * through whatever engine a host gives it.
 */
function MonoSynthPanel({
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: MonoSynthPanelProps) {
  const [preset, setPreset] = useState<string | null>(null);
  const pickPreset = useCallback(
    (name: string | null) => {
      if (name) {
        setPreset(name);
        onValueChange(monoSynthPreset(name));
      }
    },
    [onValueChange]
  );
  // A control turned by hand makes the sound the preset's no more.
  const change = useCallback(
    (state: MonoSynthState) => {
      setPreset(null);
      onValueChange(state);
    },
    [onValueChange]
  );
  const pickWave = useCallback(
    (values: unknown[]) => {
      const [wave] = values;
      if (typeof wave === "string") {
        change(monoSynthDevice.set(value, "wave", wave));
      }
    },
    [change, value]
  );
  const pickRange = useCallback(
    (values: unknown[]) => {
      const [range] = values;
      if (typeof range === "string") {
        change(monoSynthDevice.set(value, "range", range));
      }
    },
    [change, value]
  );
  const play = useCallback(
    (pitch: number, details: { velocity?: number }) =>
      onNoteOn?.({
        frequency: noteToFrequency(pitch),
        velocity: details.velocity ?? 0.8,
      }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);

  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={monoSynthDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select items={PRESET_NAMES} onValueChange={pickPreset} value={preset}>
          <SelectTrigger
            aria-label="Preset"
            className="w-28 data-[size=sm]:h-6"
            size="sm"
          >
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRESET_NAMES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <ToggleGroup
          aria-label="Wave"
          onValueChange={pickWave}
          size="sm"
          spacing={0}
          value={[value.wave]}
          variant="outline"
        >
          <ToggleGroupItem
            aria-label="Saw wave"
            className="h-6 px-1.5"
            value="sawtooth"
          >
            <SawtoothIcon aria-hidden="true" className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label="Square wave"
            className="h-6 px-1.5"
            value="square"
          >
            <SquareIcon aria-hidden="true" className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label="Triangle wave"
            className="h-6 px-1.5"
            value="triangle"
          >
            <TriangleIcon aria-hidden="true" className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          aria-label="Range"
          onValueChange={pickRange}
          size="sm"
          spacing={0}
          value={[value.range]}
          variant="outline"
        >
          {RANGE.options.map((option) => (
            <ToggleGroupItem
              aria-label={`Range ${option.label}`}
              className="h-6 px-1.5 text-xs"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="mono-synth-panel"
      >
        <DevicePanel
          device={monoSynthDevice}
          disabled={value.wave === "square" ? NONE : NOT_SQUARE}
          exclude={HEADER_CONTROLS}
          groups={GROUPS}
          onValueChange={change}
          value={value}
        />
        <Piano
          activeNotes={activeNotes}
          aria-label="Play the synth"
          className="mt-auto min-h-14 flex-1"
          maxPitch={HIGHEST}
          minPitch={LOWEST}
          onNoteOff={release}
          onNoteOn={play}
          size="sm"
        />
      </div>
    </DeviceFrame>
  );
}

export { MonoSynthPanel };