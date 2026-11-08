"use client";

import type { Pad as PadPrimitive } from "@audio-ui/react/pad";
import { type ReactNode, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Pad, PadItem } from "@/registry-audio/bases/base/audio/elements/pad";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type DrumSynthNote,
  type DrumSynthState,
  drumSynthDevice,
} from "@/registry-audio/bases/base/lib/drum-synth-device";

/** The controls by what they do. */
const GROUPS = [
  { label: "Drum", parameters: ["voice", "tune"] },
  { label: "Sound", parameters: ["decay", "tone", "snap"] },
  { label: "Output", parameters: ["volume"] },
] as const;

interface DrumSynthPanelProps {
  /** The notes held now, such as on a MIDI keyboard or from a sequencer: while any is, the pad lights up. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The pad is struck, as hard as the press is high on it. */
  onNoteOn?: (note: DrumSynthNote) => void;
  onValueChange: (state: DrumSynthState) => void;
  value: DrumSynthState;
}

const ACTIVE = ["hit"];

/**
 * The face of the Drum Synth device: which drum it is and its tuning, how
 * long it rings, how bright it is and how sharp its attack, its volume, and a
 * pad that strikes it, harder near its top. Controlled like `DevicePanel`:
 * the state is `value`, and a strike leaves through `onNoteOn`, so it plays
 * through whatever engine a host gives it.
 */
function DrumSynthPanel({
  activeNotes,
  children,
  className,
  onNoteOn,
  onValueChange,
  value,
}: DrumSynthPanelProps) {
  const strike = useCallback(
    (_pad: string, details: PadPrimitive.Root.OnEventDetails) =>
      onNoteOn?.({ velocity: details.velocity }),
    [onNoteOn]
  );
  const voice = drumSynthDevice.parameters[0].options.find(
    (option) => option.value === value.voice
  );

  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={drumSynthDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="drum-synth-panel"
      >
        <DevicePanel
          device={drumSynthDevice}
          groups={GROUPS}
          onValueChange={onValueChange}
          value={value}
        />
        <Pad
          activePads={activeNotes?.length ? ACTIVE : undefined}
          aria-label="Strike the drum"
          className="mt-auto min-h-14 flex-1"
          columns={1}
          onPadOn={strike}
        >
          <PadItem value="hit">{voice?.label}</PadItem>
        </Pad>
      </div>
    </DeviceFrame>
  );
}

export { DrumSynthPanel };
