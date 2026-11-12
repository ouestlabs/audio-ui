import { midiToHz } from "@audio-ui/engine/pitch";
import { type ReactNode, useCallback, useState } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  STRING_MACHINE_PRESETS,
  type StringMachineNote,
  type StringMachineState,
  stringMachineDevice,
  stringMachinePreset,
} from "@/components/audio-ui/devices/string-machine/device";
import { Piano } from "@/components/audio-ui/piano";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** The controls by what they do, as the machine's panel lays them out. */
const GROUPS = [
  { label: "Registers", parameters: ["violin", "viola", "cello", "bass"] },
  { label: "Tone", parameters: ["bright", "ensemble"] },
  { label: "Bow", parameters: ["attack", "release"] },
  { label: "Output", parameters: ["volume"] },
] as const;

const PRESET_NAMES = STRING_MACHINE_PRESETS.map((preset) => ({
  label: preset.name,
  value: preset.name,
}));

/** The keyboard's two octaves, from C3. */
const LOWEST = 48;
const HIGHEST = 72;

interface StringMachinePanelProps {
  /** The notes held now, such as on a MIDI keyboard: their keys light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is played, as a note of the machine. */
  onNoteOn?: (note: StringMachineNote) => void;
  onValueChange: (state: StringMachineState) => void;
  value: StringMachineState;
}

/**
 * The face of the String Machine device: its eight sounds to start from, its
 * controls by what they do (the registers, the tone, the bow and the output),
 * and a keyboard that plays it. Controlled like `DevicePanel`: the state is
 * `value`, and a key leaves through `onNoteOn` and `onNoteOff`, so it plays
 * through whatever engine a host gives it.
 */
function StringMachinePanel({
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: StringMachinePanelProps) {
  const [preset, setPreset] = useState<string | null>(null);
  const pickPreset = useCallback(
    (name: string | null) => {
      if (name) {
        setPreset(name);
        onValueChange(stringMachinePreset(name));
      }
    },
    [onValueChange]
  );
  // A control turned by hand makes the sound the preset's no more.
  const change = useCallback(
    (state: StringMachineState) => {
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
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={stringMachineDevice}
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
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="string-machine-panel"
      >
        <DevicePanel
          device={stringMachineDevice}
          groups={GROUPS}
          onValueChange={change}
          value={value}
        />
        <Piano
          activeNotes={activeNotes}
          aria-label="Play the strings"
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

export { StringMachinePanel };
