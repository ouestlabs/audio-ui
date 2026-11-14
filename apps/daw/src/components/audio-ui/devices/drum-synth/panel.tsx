import type { Pad as PadPrimitive } from "@audio-ui/react/pad";
import { type ReactNode, useCallback, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type DrumSynthNote,
  type DrumSynthState,
  drumSynthDevice,
} from "@/components/audio-ui/devices/drum-synth/device";
import { Pad, PadItem } from "@/components/audio-ui/pad";
import { LevelPlot } from "@/components/audio-ui/signal-plot";
import type { DeviceSignal } from "@/lib/device-signal";
import { cn } from "@/lib/utils";

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
  /** Its live sound: the level of what it plays over the last two seconds, each hit's attack and decay. */
  signal?: DeviceSignal;
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
  signal,
  value,
}: DrumSynthPanelProps) {
  // Each hit as it rang: its attack and its decay, the newest at the end.
  const live = useMemo(
    () => signal?.output.history({ of: "level", points: 240, seconds: 2 }),
    [signal]
  );
  const strike = useCallback(
    (_pad: string, details: PadPrimitive.Root.OnEventDetails) =>
      onNoteOn?.({ velocity: details.velocity }),
    [onNoteOn]
  );
  const voice = drumSynthDevice.parameters[0].options.find(
    (option) => option.value === value.voice
  );

  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
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
        {live ? (
          <LevelPlot
            aria-label="What it played over the last two seconds"
            source={live}
          />
        ) : null}
        <Pad
          activePads={activeNotes?.length ? ACTIVE : undefined}
          aria-label="Strike the drum"
          // One pad across the panel, in the room left under the controls, not square.
          className="mt-auto min-h-14 flex-1 grid-rows-[minmax(0,1fr)]"
          columns={1}
          onPadOn={strike}
        >
          <PadItem
            className="aspect-auto h-full items-center justify-center"
            value="hit"
          >
            {voice?.label}
          </PadItem>
        </Pad>
      </div>
    </DeviceFrame>
  );
}

export { DrumSynthPanel };
