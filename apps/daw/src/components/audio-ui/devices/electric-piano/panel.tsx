"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
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
import { Piano } from "@/components/audio-ui/piano";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  ELECTRIC_PIANO_PRESETS,
  type ElectricPianoNote,
  type ElectricPianoState,
  electricPianoDevice,
  electricPianoPreset,
} from "@/components/audio-ui/devices/electric-piano/device";

/** The controls by what they do, as the piano's panel lays them out. */
const GROUPS = [
  { label: "Tone", parameters: ["bark", "bell", "decay"] },
  { label: "Pickup", parameters: ["drive"] },
  { label: "Tremolo", parameters: ["rate", "depth"] },
  { label: "Output", parameters: ["volume"] },
] as const;

const PRESET_NAMES = ELECTRIC_PIANO_PRESETS.map((preset) => ({
  label: preset.name,
  value: preset.name,
}));

/** The keyboard's two octaves, from C3. */
const LOWEST = 48;
const HIGHEST = 72;

interface ElectricPianoPanelProps {
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is struck, as a note of the piano. */
  onNoteOn?: (note: ElectricPianoNote) => void;
  onValueChange: (state: ElectricPianoState) => void;
  value: ElectricPianoState;
}

/**
 * The face of the Electric Piano device: its four sounds to start from in its
 * title bar, its controls by what they do (the tone, the pickup, the tremolo,
 * the output), and a keyboard that plays it. Controlled like `DevicePanel`:
 * the state is `value`, and a key leaves through `onNoteOn` and `onNoteOff`,
 * so it plays through whatever engine a host gives it.
 */
function ElectricPianoPanel({
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: ElectricPianoPanelProps) {
  const [preset, setPreset] = useState<string | null>(null);
  const pickPreset = useCallback(
    (name: string | null) => {
      if (name) {
        setPreset(name);
        onValueChange(electricPianoPreset(name));
      }
    },
    [onValueChange]
  );
  // A control turned by hand makes the sound the preset's no more.
  const change = useCallback(
    (state: ElectricPianoState) => {
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
        device={electricPianoDevice}
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
        data-slot="electric-piano-panel"
      >
        <DevicePanel
          className="grid-cols-4"
          device={electricPianoDevice}
          groups={GROUPS}
          onValueChange={change}
          value={value}
        />
        <Piano
          aria-label="Play the piano"
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

export { ElectricPianoPanel };