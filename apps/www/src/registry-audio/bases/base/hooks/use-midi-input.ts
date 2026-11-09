"use client";

import { createMidiInput, pitchBendToSemitones } from "@audio-ui/core/midi";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The page's one MIDI input: every component that calls the hook shares it. */
const midiInput = createMidiInput();

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
  /** The names of the devices switched off with `setInputEnabled`: their keys are not heard. */
  mutedInputs: string[];
  /** Connects the page's MIDI input. Call it from a user gesture (e.g. a button click): browsers may prompt for permission. */
  requestAccess: () => void;
  /** Switches a device off by its name, for the whole page, or on again. It holds before the device connects. */
  setInputEnabled: (name: string, enabled: boolean) => void;
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
    midiInput.subscribe,
    midiInput.getSnapshot,
    midiInput.getServerSnapshot
  );
  const [activeNotes, setActiveNotes] = useState<number[]>([]);

  const handlers = useRef({ onNoteOff, onNoteOn, onPitchBend });
  handlers.current = { onNoteOff, onNoteOn, onPitchBend };

  useEffect(
    () =>
      midiInput.listen((message) => {
        if (message.type === "noteon") {
          setActiveNotes((held) =>
            held.includes(message.note) ? held : [...held, message.note]
          );
          handlers.current.onNoteOn?.(message.note, message.velocity);
        } else if (message.type === "noteoff") {
          setActiveNotes((held) =>
            held.filter((note) => note !== message.note)
          );
          handlers.current.onNoteOff?.(message.note);
        } else if (message.type === "pitchbend") {
          handlers.current.onPitchBend?.(pitchBendToSemitones(message.value));
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
    disconnect: midiInput.disconnect,
    error: state.error,
    inputNames: state.inputs,
    isConnected: state.connected,
    isSupported: state.supported,
    mutedInputs: state.muted,
    requestAccess: midiInput.connect,
    setInputEnabled: midiInput.setInputEnabled,
  };
}
