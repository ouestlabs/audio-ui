"use client";

import { midiToHz } from "@audio/note";
import { type ReactNode, useCallback, useState } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  POLY_SYNTH_PRESETS,
  type PolySynthNote,
  type PolySynthState,
  polySynthDevice,
  polySynthPreset,
} from "@/components/audio-ui/devices/poly-synth/device";
import { Piano } from "@/components/audio-ui/piano";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** The controls by what they do, as the synth's panel lays them out. */
const GROUPS = [
  {
    label: "Oscillators",
    parameters: ["saw", "pulse", "width", "sub", "noise"],
  },
  { label: "Filter", parameters: ["cutoff", "resonance", "contour", "keys"] },
  { label: "Envelope", parameters: ["attack", "decay", "sustain", "release"] },
  { label: "Vibrato", parameters: ["rate", "vibrato"] },
  { label: "Output", parameters: ["volume"] },
] as const;

/** What the title bar holds, next to the presets: the chorus, a switch of three. */
const HEADER_CONTROLS = ["chorus"] as const;
const CHORUS = polySynthDevice.parameters.find(
  (parameter) => parameter.id === "chorus"
) as Extract<(typeof polySynthDevice.parameters)[number], { id: "chorus" }>;

const PRESET_NAMES = POLY_SYNTH_PRESETS.map((preset) => ({
  label: preset.name,
  value: preset.name,
}));

/** The keyboard's two octaves, from C3. */
const LOWEST = 48;
const HIGHEST = 72;

interface PolySynthPanelProps {
  /** The notes held now, such as on a MIDI keyboard: their keys light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is played, as a note of the synth. */
  onNoteOn?: (note: PolySynthNote) => void;
  onValueChange: (state: PolySynthState) => void;
  value: PolySynthState;
}

/**
 * The face of the Poly Synth device: its eight sounds to start from, its
 * controls by what they do (the oscillators, the filter, the envelope, the
 * vibrato and the chorus), and a keyboard that plays it. Controlled like
 * `DevicePanel`: the state is `value`, and a key leaves through `onNoteOn`
 * and `onNoteOff`, so it plays through whatever engine a host gives it.
 */
function PolySynthPanel({
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: PolySynthPanelProps) {
  const [preset, setPreset] = useState<string | null>(null);
  const pickPreset = useCallback(
    (name: string | null) => {
      if (name) {
        setPreset(name);
        onValueChange(polySynthPreset(name));
      }
    },
    [onValueChange]
  );
  // A control turned by hand makes the sound the preset's no more.
  const change = useCallback(
    (state: PolySynthState) => {
      setPreset(null);
      onValueChange(state);
    },
    [onValueChange]
  );
  const pickChorus = useCallback(
    (values: unknown[]) => {
      const [chorus] = values;
      if (typeof chorus === "string") {
        change(polySynthDevice.set(value, "chorus", chorus));
      }
    },
    [change, value]
  );
  const play = useCallback(
    (pitch: number, details: { velocity?: number }) =>
      onNoteOn?.({
        frequency: midiToHz(pitch),
        velocity: details.velocity ?? 0.8,
      }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);

  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={polySynthDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select items={PRESET_NAMES} onValueChange={pickPreset} value={preset}>
          <SelectTrigger
            aria-label="Preset"
            className="w-32 data-[size=sm]:h-6"
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
          aria-label="Chorus"
          onValueChange={pickChorus}
          size="sm"
          spacing={0}
          value={[value.chorus]}
          variant="outline"
        >
          {CHORUS.options.map((option) => (
            <ToggleGroupItem
              aria-label={`Chorus ${option.label}`}
              className="h-6 px-2 text-xs"
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
        data-slot="poly-synth-panel"
      >
        <DevicePanel
          className="grid-cols-5"
          device={polySynthDevice}
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

export { PolySynthPanel };
