"use client";

import type { Source } from "@audio-ui/react";
import { useCallback, useMemo, useState } from "react";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import { useComputerKeyboard } from "@/hooks/use-computer-keyboard";
import { useMidiInput } from "@/hooks/use-midi-input";
import type { ArrangementDoc } from "@/lib/arrangement-state";
import { useSavedState } from "./use-saved-view";
import type { useTake } from "./use-take";

/**
 * What plays into a take: the MIDI input and the computer's keyboard, heard
 * on the armed MIDI tracks' instruments (REC-002, REC-003) and kept by the
 * take; arming, which asks for MIDI in its gesture; and the transport's
 * position, counting a count-in back before playback takes over.
 */
export function useTakeInputs({
  doc,
  engine,
  take,
}: {
  doc: ArrangementDoc;
  engine: ReturnType<typeof useArrangementEngine>;
  take: ReturnType<typeof useTake>;
}) {
  const armedMidi = useMemo(
    () =>
      doc.tracks
        .filter((track) => track.kind === "midi" && take.armed.has(track.id))
        .map((track) => track.id),
    [doc.tracks, take.armed]
  );
  // The notes held now, from the MIDI input or the computer's keys: what the armed tracks' instruments light up.
  const [heldNotes, setHeldNotes] = useState<readonly number[]>([]);
  const playNoteOff = useCallback(
    (note: number) => {
      for (const track of armedMidi) {
        engine.engine?.noteOff(track, note);
      }
      take.noteOff(note);
      setHeldNotes((held) => held.filter((pitch) => pitch !== note));
    },
    [armedMidi, engine.engine, take]
  );
  const playNoteOn = useCallback(
    (note: number, velocity: number) => {
      for (const track of armedMidi) {
        engine.engine?.noteOn(track, note, velocity);
      }
      take.noteOn(note, velocity);
      setHeldNotes((held) => (held.includes(note) ? held : [...held, note]));
    },
    [armedMidi, engine.engine, take]
  );
  const midiInput = useMidiInput({
    onNoteOff: playNoteOff,
    onNoteOn: playNoteOn,
  });
  const [computerKeys, setComputerKeys] = useSavedState("computerKeys", false);
  const computerKeysOn = computerKeys && armedMidi.length > 0;
  useComputerKeyboard({
    enabled: computerKeysOn,
    onNoteOff: playNoteOff,
    onNoteOn: playNoteOn,
  });

  const armTrack = useCallback(
    (track: string, exclusive: boolean) => {
      take.arm(track, exclusive);
      const kind = doc.tracks.find((item) => item.id === track)?.kind;
      // The browser asks for MIDI in the gesture that arms a MIDI track.
      if (kind === "midi" && midiInput.isSupported && !midiInput.isConnected) {
        midiInput.requestAccess();
      }
    },
    [doc.tracks, midiInput, take]
  );

  const transportPosition = useMemo<Source<number>>(
    () => ({
      getSnapshot: () =>
        take.countdown.getSnapshot() ?? engine.position.getSnapshot(),
      subscribe: (listener: () => void) => {
        const stopCountdown = take.countdown.subscribe(listener);
        const stopPosition = engine.position.subscribe(listener);
        return () => {
          stopCountdown();
          stopPosition();
        };
      },
    }),
    [engine.position, take.countdown]
  );

  return {
    armTrack,
    computerKeys,
    /** Whether the keys play notes now: on, and a MIDI track armed. */
    computerKeysOn,
    heldNotes,
    setComputerKeys,
    transportPosition,
  };
}
