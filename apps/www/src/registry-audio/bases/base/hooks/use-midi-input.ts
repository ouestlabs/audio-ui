"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { $midiInput } from "@/registry-audio/bases/base/lib/midi-input";

/** The top of MIDI's 7-bit velocity. */
const MAX_MIDI_VELOCITY = 127;

export interface UseMidiInputOptions {
  onNoteOff?: (note: number) => void;
  /** Fires on every key pressed on a connected device, with its velocity from 0 to 1. */
  onNoteOn?: (note: number, velocity: number) => void;
  /** Fires on every pitch bend wheel movement, in semitones (±2 at the wheel's extremes, 0 centered). */
  onPitchBend?: (semitones: number) => void;
}

export interface UseMidiInputReturn {
  /** Notes currently held on the connected MIDI device, pass straight to Piano's `activeNotes`. */
  activeNotes: number[];
  /** Stops listening to every device, for the whole page. Any notes already sounding keep sounding, release them yourself (e.g. a synth's `releaseAll`) if that's not what you want. */
  disconnect: () => void;
  error: string | null;
  inputNames: string[];
  isConnected: boolean;
  isSupported: boolean;
  /** Connects the page's MIDI input. Call it from a user gesture (e.g. a button click): browsers may prompt for permission. */
  requestAccess: () => void;
}

/**
 * The notes of the page's MIDI input. Every component that calls it hears the
 * same devices, and connecting from any of them, or from a
 * `MidiConnectControl` anywhere on the page, connects them all.
 */
export function useMidiInput({
  onNoteOff,
  onNoteOn,
  onPitchBend,
}: UseMidiInputOptions = {}): UseMidiInputReturn {
  const state = useSyncExternalStore(
    $midiInput.subscribe,
    $midiInput.getSnapshot,
    $midiInput.getServerSnapshot
  );
  const [activeNotes, setActiveNotes] = useState<number[]>([]);

  const handlers = useRef({ onNoteOff, onNoteOn, onPitchBend });
  handlers.current = { onNoteOff, onNoteOn, onPitchBend };

  useEffect(
    () =>
      $midiInput.listen((event) => {
        if (event.type === "noteon") {
          setActiveNotes((held) =>
            held.includes(event.note) ? held : [...held, event.note]
          );
          handlers.current.onNoteOn?.(
            event.note,
            event.velocity / MAX_MIDI_VELOCITY
          );
        } else if (event.type === "noteoff") {
          setActiveNotes((held) => held.filter((note) => note !== event.note));
          handlers.current.onNoteOff?.(event.note);
        } else {
          handlers.current.onPitchBend?.(event.semitones);
        }
      }),
    []
  );

  // Keys held when the device goes away are let go.
  useEffect(() => {
    if (!state.connected) {
      setActiveNotes([]);
    }
  }, [state.connected]);

  return {
    activeNotes,
    disconnect: $midiInput.disconnect,
    error: state.error,
    inputNames: state.inputs,
    isConnected: state.connected,
    isSupported: state.supported,
    requestAccess: $midiInput.connect,
  };
}
