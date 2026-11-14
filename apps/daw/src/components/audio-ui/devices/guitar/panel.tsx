import { midiToHz } from "@audio-ui/engine/pitch";
import { type ReactNode, useCallback, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  GUITAR_HIGHEST,
  GUITAR_LOWEST,
  type GuitarNote,
  type GuitarState,
  guitarDevice,
} from "@/components/audio-ui/devices/guitar/device";
import { Piano } from "@/components/audio-ui/piano";
import { ScopePlot } from "@/components/audio-ui/signal-plot";
import type { DeviceSignal } from "@/lib/device-signal";
import { cn } from "@/lib/utils";

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
  /** Its live sound: the wave it plays now, held still on each cycle. */
  signal?: DeviceSignal;
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
  signal,
  value,
}: GuitarPanelProps) {
  // The string as it rings, held still on each cycle.
  const live = useMemo(() => signal?.output.scope({ fit: true }), [signal]);
  const play = useCallback(
    (pitch: number) => onNoteOn?.({ frequency: midiToHz(pitch) }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);

  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
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
        {live ? (
          <ScopePlot aria-label="The wave it plays" source={live} />
        ) : null}
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
