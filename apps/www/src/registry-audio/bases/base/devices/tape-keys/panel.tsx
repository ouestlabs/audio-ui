"use client";

import { midiToHz } from "@audio-ui/engine/pitch";
import { type ReactNode, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  TAPE_KEYS_HIGHEST,
  TAPE_KEYS_LOWEST,
  type TapeKeysNote,
  type TapeKeysState,
  tapeKeysDevice,
} from "@/registry-audio/bases/base/devices/tape-keys/device";

/** The controls by what they do. */
const GROUPS = [
  { label: "Tape", parameters: ["speed", "wow", "tone"] },
  { label: "Output", parameters: ["volume"] },
] as const;

/** What the title bar holds: the track the heads read, a switch of three. */
const HEADER_CONTROLS = ["station"] as const;
const STATION = tapeKeysDevice.parameters.find(
  (parameter) => parameter.id === "station"
) as Extract<(typeof tapeKeysDevice.parameters)[number], { id: "station" }>;

interface TapeKeysPanelProps {
  /** The notes held now, such as on a MIDI keyboard: their keys light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is played, as a note of the keyboard. */
  onNoteOn?: (note: TapeKeysNote) => void;
  onValueChange: (state: TapeKeysState) => void;
  value: TapeKeysState;
}

/**
 * The face of the Tape Keys device: the track its heads read in its title
 * bar, the tape's speed, wow and tone and the volume, and its 35 keys, G2 to
 * F5. Controlled like `DevicePanel`: the state is `value`, and a key leaves
 * through `onNoteOn` and `onNoteOff`, so it plays through whatever engine a
 * host gives it.
 */
function TapeKeysPanel({
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: TapeKeysPanelProps) {
  const pickStation = useCallback(
    (values: unknown[]) => {
      const [station] = values;
      if (typeof station === "string") {
        onValueChange(tapeKeysDevice.set(value, "station", station));
      }
    },
    [onValueChange, value]
  );
  const play = useCallback(
    (pitch: number) => onNoteOn?.({ frequency: midiToHz(pitch) }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);

  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={tapeKeysDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <ToggleGroup
          aria-label={STATION.label}
          onValueChange={pickStation}
          size="sm"
          spacing={0}
          value={[value.station]}
          variant="outline"
        >
          {STATION.options.map((option) => (
            <ToggleGroupItem
              aria-label={`${option.label} track`}
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
        data-slot="tape-keys-panel"
      >
        <DevicePanel
          device={tapeKeysDevice}
          exclude={HEADER_CONTROLS}
          groups={GROUPS}
          onValueChange={onValueChange}
          value={value}
        />
        <Piano
          activeNotes={activeNotes}
          aria-label="Play the tapes"
          className="mt-auto min-h-14 flex-1"
          maxPitch={TAPE_KEYS_HIGHEST}
          minPitch={TAPE_KEYS_LOWEST}
          onNoteOff={release}
          onNoteOn={play}
          size="sm"
        />
      </div>
    </DeviceFrame>
  );
}

export { TapeKeysPanel };
