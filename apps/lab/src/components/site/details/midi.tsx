import { pitchName } from "@audio-ui/core/pitch";
import { useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { useMidiInput } from "@/hooks/use-midi-input";

interface Struck {
  note: number;
  velocity: number;
}

/** The page's MIDI keyboard, as the device hears it: which one, the keys held and the last one struck. */
export function Midi() {
  const [last, setLast] = useState<Struck | null>(null);
  const midi = useMidiInput({
    onNoteOn: (note, velocity) => setLast({ note, velocity }),
  });

  if (!midi.isSupported) {
    return (
      <p className="text-muted-foreground text-sm">
        This browser has no Web MIDI.
      </p>
    );
  }
  if (!midi.isConnected) {
    return (
      <p className="text-muted-foreground text-sm">
        No keyboard connected. Connect MIDI in the bar, and play.
      </p>
    );
  }

  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between gap-2">
        <dt className="text-muted-foreground">Input</dt>
        <dd className="truncate text-right">{midi.inputNames.join(", ")}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted-foreground">Held</dt>
        <dd className="flex flex-wrap justify-end gap-1">
          {midi.activeNotes.length > 0
            ? midi.activeNotes.map((note) => (
                <Kbd className="border" key={note}>
                  {pitchName(note)}
                </Kbd>
              ))
            : "none"}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted-foreground">Last</dt>
        <dd className="tabular-nums">
          {last
            ? `${pitchName(last.note)}, velocity ${Math.round(last.velocity * 127)}`
            : "none yet"}
        </dd>
      </div>
    </dl>
  );
}
