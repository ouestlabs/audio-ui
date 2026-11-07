"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
import { type ReactNode, useCallback, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  FM_SYNTH_PRESETS,
  type FmSynthNote,
  type FmSynthState,
  fmSynthDevice,
  fmSynthPreset,
} from "@/registry-audio/bases/base/lib/fm-synth-device";

/** The controls by what they do: what every operator shares, then each operator's four. */
const GROUPS = [
  {
    label: "Global",
    parameters: [
      "algorithm",
      "feedback",
      "attack",
      "release",
      "vibrato",
      "volume",
    ],
  },
  {
    label: "Operator 1",
    parameters: ["ratio1", "level1", "decay1", "sustain1"],
  },
  {
    label: "Operator 2",
    parameters: ["ratio2", "level2", "decay2", "sustain2"],
  },
  {
    label: "Operator 3",
    parameters: ["ratio3", "level3", "decay3", "sustain3"],
  },
  {
    label: "Operator 4",
    parameters: ["ratio4", "level4", "decay4", "sustain4"],
  },
] as const;

const PRESET_NAMES = FM_SYNTH_PRESETS.map((preset) => ({
  label: preset.name,
  value: preset.name,
}));

/** The keyboard's two octaves, from C3. */
const LOWEST = 48;
const HIGHEST = 72;

interface FmSynthPanelProps {
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is played, as a note of the synth. */
  onNoteOn?: (note: FmSynthNote) => void;
  onValueChange: (state: FmSynthState) => void;
  value: FmSynthState;
}

/**
 * The face of the FM Synth device: its eight sounds to start from in its
 * title bar, what every operator shares (the algorithm, the feedback, the
 * attack, the release, the vibrato, the volume), each operator's ratio, level,
 * decay and sustain, and a keyboard that plays it. Controlled like
 * `DevicePanel`: the state is `value`, and a key leaves through `onNoteOn`
 * and `onNoteOff`, so it plays through whatever engine a host gives it.
 */
function FmSynthPanel({
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: FmSynthPanelProps) {
  const [preset, setPreset] = useState<string | null>(null);
  const pickPreset = useCallback(
    (name: string | null) => {
      if (name) {
        setPreset(name);
        onValueChange(fmSynthPreset(name));
      }
    },
    [onValueChange]
  );
  // A control turned by hand makes the sound the preset's no more.
  const change = useCallback(
    (state: FmSynthState) => {
      setPreset(null);
      onValueChange(state);
    },
    [onValueChange]
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
        device={fmSynthDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select items={PRESET_NAMES} onValueChange={pickPreset} value={preset}>
          <SelectTrigger aria-label="Preset" className="h-6 w-32" size="sm">
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
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="fm-synth-panel"
      >
        <DevicePanel
          className="grid-cols-6"
          device={fmSynthDevice}
          groups={GROUPS}
          onValueChange={change}
          value={value}
        />
        <Piano
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

export { FmSynthPanel };
