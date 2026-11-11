"use client";

import { midiToHz } from "@audio/note";
import { type ReactNode, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  GUITAR_HIGHEST,
  GUITAR_LOWEST,
  type GuitarNote,
  type GuitarState,
  guitarDevice,
} from "@/registry-audio/bases/base/devices/guitar/device";

/** The controls by what they do. */
const GROUPS = [
  { label: "String", parameters: ["tone", "decay", "mute"] },
  { label: "Body", parameters: ["body"] },
  { label: "Output", parameters: ["volume"] },
] as const;

interface GuitarPanelProps {
  /** The notes held now, such as on a MIDI keyboard: their keys light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is played, as a note of the keyboard. */
  onNoteOn?: (note: GuitarNote) => void;
  onValueChange: (state: GuitarState) => void;
  value: GuitarState;
}

/**
 * The face of the Guitar device: the string's tone, decay and palm mute, the
 * body and the volume, and a keyboard from the open low E up three octaves.
 * Controlled like `DevicePanel`: the state is `value`, and a key leaves
 * through `onNoteOn` and `onNoteOff`, so it plays through whatever engine a
 * host gives it.
 */
function GuitarPanel({
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: GuitarPanelProps) {
  const play = useCallback(
    (pitch: number) => onNoteOn?.({ frequency: midiToHz(pitch) }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);

  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={guitarDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="guitar-panel"
      >
        <DevicePanel
          device={guitarDevice}
          groups={GROUPS}
          onValueChange={onValueChange}
          value={value}
        />
        <Piano
          activeNotes={activeNotes}
          aria-label="Pick the strings"
          className="mt-auto min-h-14 flex-1"
          maxPitch={GUITAR_HIGHEST}
          minPitch={GUITAR_LOWEST}
          onNoteOff={release}
          onNoteOn={play}
          size="sm"
        />
      </div>
    </DeviceFrame>
  );
}

export { GuitarPanel };
