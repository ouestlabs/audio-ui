import { midiToHz } from "@audio-ui/engine/pitch";
import { type ReactNode, useCallback, useState, useMemo } from "react";
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
import { ScopePlot } from "@/registry-audio/bases/base/audio/elements/signal-plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  ELECTRIC_PIANO_PRESETS,
  type ElectricPianoNote,
  type ElectricPianoState,
  electricPianoDevice,
  electricPianoPreset,
} from "@/registry-audio/bases/base/devices/electric-piano/device";
import type { DeviceSignal } from "@/registry-audio/bases/base/lib/device-signal";

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
  /** The notes held now, such as on a MIDI keyboard: their keys light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is struck, as a note of the piano. */
  onNoteOn?: (note: ElectricPianoNote) => void;
  onValueChange: (state: ElectricPianoState) => void;
  /** Its live sound: the wave it plays now, held still on each cycle. */
  signal?: DeviceSignal;
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
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  signal,
  value,
}: ElectricPianoPanelProps) {
  // The wave it plays now, held still on each cycle.
  const live = useMemo(() => signal?.output.scope({ fit: true }), [signal]);
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
        frequency: midiToHz(pitch),
        velocity: details.velocity ?? 0.8,
      }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);

  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        device={electricPianoDevice}
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
        {live ? (
          <ScopePlot aria-label="The wave it plays" source={live} />
        ) : null}
        <Piano
          activeNotes={activeNotes}
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
