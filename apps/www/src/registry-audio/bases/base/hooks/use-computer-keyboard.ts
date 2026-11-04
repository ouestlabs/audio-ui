"use client";

import { useEffect, useRef, useState } from "react";
import {
  COMPUTER_KEYBOARD_OCTAVES,
  COMPUTER_KEYBOARD_VELOCITIES,
  controlOfKey,
  noteOfKey,
} from "@/registry-audio/bases/base/lib/computer-keyboard";

const OCTAVES = [
  -COMPUTER_KEYBOARD_OCTAVES,
  COMPUTER_KEYBOARD_OCTAVES,
] as const;
const VELOCITY_RANGE = [0, COMPUTER_KEYBOARD_VELOCITIES.length - 1] as const;

const clamp = (value: number, [low, high]: readonly [number, number]) =>
  Math.max(low, Math.min(high, value));

/** Whether a key is not for the keyboard of notes: a repeat, a shortcut with Cmd, Ctrl or Alt, or typing into a field. */
function ignored(event: KeyboardEvent) {
  const element = event.target as HTMLElement | null;
  return (
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    Boolean(
      element?.closest?.("input, textarea, select, [contenteditable=true]")
    )
  );
}

export interface UseComputerKeyboardOptions {
  /** Whether the keys play: off, they are the page's again. */
  enabled: boolean;
  onNoteOff: (note: number) => void;
  /** A key pressed: its note, and the velocity set with C and V, 0…1. */
  onNoteOn: (note: number, velocity: number) => void;
}

/**
 * Plays notes from the computer's keyboard while `enabled` (`noteOfKey`'s
 * layout): a key held is one note, released when the key is, or when the
 * keys are turned off or the window loses focus. Z and X move an octave, C
 * and V the velocity. Keys typed into a field, or held with Cmd, Ctrl or Alt,
 * are left alone.
 */
export function useComputerKeyboard({
  enabled,
  onNoteOff,
  onNoteOn,
}: UseComputerKeyboardOptions) {
  const [octave, setOctave] = useState(0);
  const [velocityIndex, setVelocityIndex] = useState(4);
  const handlers = useRef({ onNoteOff, onNoteOn });
  handlers.current = { onNoteOff, onNoteOn };
  const state = useRef({ octave, velocityIndex });
  state.current = { octave, velocityIndex };

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // The note each key plays while it is held, so an octave changed under a held key still lets go of it.
    const held = new Map<string, number>();
    const releaseAll = () => {
      for (const note of held.values()) {
        handlers.current.onNoteOff(note);
      }
      held.clear();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (ignored(event)) {
        return;
      }
      const change = controlOfKey(event.code);
      if (change) {
        event.preventDefault();
        if ("octave" in change) {
          setOctave((current) => clamp(current + change.octave, OCTAVES));
        } else {
          setVelocityIndex((current) =>
            clamp(current + change.velocity, VELOCITY_RANGE)
          );
        }
        return;
      }
      const note = noteOfKey(event.code, state.current.octave);
      if (note === null || held.has(event.code)) {
        return;
      }
      event.preventDefault();
      held.set(event.code, note);
      handlers.current.onNoteOn(
        note,
        COMPUTER_KEYBOARD_VELOCITIES[state.current.velocityIndex] ?? 0.8
      );
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const note = held.get(event.code);
      if (note !== undefined) {
        held.delete(event.code);
        handlers.current.onNoteOff(note);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [enabled]);

  return {
    /** Octaves from middle C, -4 to 4. */
    octave,
    /** The velocity a key plays at, 0…1. */
    velocity: COMPUTER_KEYBOARD_VELOCITIES[velocityIndex] ?? 0.8,
  };
}
