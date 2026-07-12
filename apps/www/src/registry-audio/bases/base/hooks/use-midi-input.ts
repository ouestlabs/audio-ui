"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type MidiEvent,
  parseMidiMessage,
} from "@/registry-audio/bases/base/lib/midi";

export interface UseMidiInputOptions {
  onNoteOff?: (note: number) => void;
  onNoteOn?: (note: number, velocity: number) => void;
  /** Fires on every pitch bend wheel movement, in semitones (±2 at the wheel's extremes, 0 centered). */
  onPitchBend?: (semitones: number) => void;
}

export interface UseMidiInputReturn {
  /** Notes currently held on the connected MIDI device — pass straight to Piano's `activeNotes`. */
  activeNotes: number[];
  /** Detaches all input listeners and resets connection state. Any notes already sounding keep sounding — release them yourself (e.g. a synth's `releaseAll`) if that's not what you want. */
  disconnect: () => void;
  error: string | null;
  inputNames: string[];
  isConnected: boolean;
  isSupported: boolean;
  /** Must be called from a user gesture (e.g. a button click) — browsers may prompt for permission. */
  requestAccess: () => void;
}

const isMidiSupported = () =>
  typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

export function useMidiInput({
  onNoteOff,
  onNoteOn,
  onPitchBend,
}: UseMidiInputOptions = {}): UseMidiInputReturn {
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [inputNames, setInputNames] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNoteOnRef = useRef(onNoteOn);
  onNoteOnRef.current = onNoteOn;
  const onNoteOffRef = useRef(onNoteOff);
  onNoteOffRef.current = onNoteOff;
  const onPitchBendRef = useRef(onPitchBend);
  onPitchBendRef.current = onPitchBend;
  const accessRef = useRef<MIDIAccess | null>(null);

  const handleMidiEvent = useCallback((event: MidiEvent) => {
    if (event.type === "noteon") {
      setActiveNotes((prev) =>
        prev.includes(event.note) ? prev : [...prev, event.note]
      );
      onNoteOnRef.current?.(event.note, event.velocity);
    } else if (event.type === "noteoff") {
      setActiveNotes((prev) => prev.filter((note) => note !== event.note));
      onNoteOffRef.current?.(event.note);
    } else {
      onPitchBendRef.current?.(event.semitones);
    }
  }, []);

  const handleMessage = useCallback(
    (event: MIDIMessageEvent) => {
      const parsed = parseMidiMessage(event.data);
      if (parsed) {
        handleMidiEvent(parsed);
      }
    },
    [handleMidiEvent]
  );

  const attachInputs = useCallback(
    (access: MIDIAccess) => {
      const names: string[] = [];
      for (const input of access.inputs.values()) {
        input.onmidimessage = handleMessage;
        names.push(input.name ?? "MIDI device");
      }
      setInputNames(names);
      setIsConnected(names.length > 0);
    },
    [handleMessage]
  );

  const requestAccess = useCallback(() => {
    if (!isMidiSupported()) {
      setError("Web MIDI API is not supported in this browser.");
      return;
    }
    navigator
      .requestMIDIAccess?.()
      .then((access) => {
        accessRef.current = access;
        setError(null);
        attachInputs(access);
        access.onstatechange = () => attachInputs(access);
      })
      .catch(() => {
        setError("MIDI access was denied.");
      });
  }, [attachInputs]);

  const detachInputs = useCallback(() => {
    const access = accessRef.current;
    if (!access) {
      return;
    }
    access.onstatechange = null;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }
    accessRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    detachInputs();
    setIsConnected(false);
    setInputNames([]);
    setActiveNotes([]);
  }, [detachInputs]);

  useEffect(() => detachInputs, [detachInputs]);

  return {
    activeNotes,
    disconnect,
    error,
    inputNames,
    isConnected,
    isSupported: isMidiSupported(),
    requestAccess,
  };
}
