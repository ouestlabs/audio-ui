/**
 * The keyboard of the workstation (docs/daw-spec/shortcuts.md): the
 * reference's keys, with Cmd on a Mac and Ctrl elsewhere. Chrome keeps Cmd+T
 * and Cmd+Shift+T for its tabs before a page hears them, so Ctrl+T and
 * Ctrl+Shift+T do the same on a Mac.
 */
export type ShortcutCommand =
  | "audio-track"
  | "continue"
  | "deactivate"
  | "delete"
  | "detail"
  | "duplicate"
  | "export"
  | "grid-finer"
  | "grid-fixed"
  | "grid-snap"
  | "grid-triplet"
  | "grid-wider"
  | "library"
  | "loop"
  | "midi-track"
  | "mixer"
  | "play-stop"
  | "redo"
  | "return-track"
  | "select-all"
  | "solo"
  | "split"
  | "to-start"
  | "undo"
  | "zoom-back"
  | "zoom-in"
  | "zoom-out"
  | "zoom-selection";

interface Shortcut {
  alt?: boolean;
  command: ShortcutCommand;
  /** Ctrl itself, on a Mac: what stands in for a key the browser keeps. */
  control?: boolean;
  /** The key, as `KeyboardEvent.key` names it, lower case for a letter. */
  key: string;
  /** Cmd on a Mac, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { command: "play-stop", key: " " },
  { command: "continue", key: " ", shift: true },
  { command: "to-start", key: "home" },
  { command: "loop", key: "l", mod: true },
  { command: "undo", key: "z", mod: true },
  { command: "redo", key: "z", mod: true, shift: true },
  { command: "redo", key: "y", mod: true },
  { command: "audio-track", key: "t", mod: true },
  { command: "audio-track", control: true, key: "t" },
  { command: "midi-track", key: "t", mod: true, shift: true },
  { command: "midi-track", control: true, key: "t", shift: true },
  { alt: true, command: "return-track", key: "t", mod: true },
  { command: "delete", key: "delete" },
  { command: "delete", key: "backspace" },
  { command: "split", key: "e", mod: true },
  { command: "duplicate", key: "d", mod: true },
  { command: "deactivate", key: "0" },
  { command: "solo", key: "s" },
  { command: "select-all", key: "a", mod: true },
  { alt: true, command: "mixer", key: "m", mod: true },
  { alt: true, command: "library", key: "b", mod: true },
  { command: "detail", key: "tab", shift: true },
  { command: "export", key: "r", mod: true, shift: true },
  { command: "grid-finer", key: "1", mod: true },
  { command: "grid-wider", key: "2", mod: true },
  { command: "grid-triplet", key: "3", mod: true },
  { command: "grid-snap", key: "4", mod: true },
  { command: "grid-fixed", key: "5", mod: true },
  { command: "zoom-in", key: "=", mod: true },
  { command: "zoom-in", key: "+", mod: true },
  { command: "zoom-out", key: "-", mod: true },
  { command: "zoom-selection", key: "z" },
  { command: "zoom-back", key: "x" },
];

const APPLE = /Mac|iPhone|iPad/;
const LETTER_CODE = /^Key[A-Z]$/;
const DIGIT_CODE = /^Digit\d$/;

const isMac = () =>
  typeof navigator !== "undefined" && APPLE.test(navigator.platform);

/** The key a press names: its letter even with Option held, which changes `key` on a Mac, and a digit by its place, which a layout such as AZERTY reaches with Shift. */
function keyOf(event: KeyboardEvent): string {
  if (event.altKey && LETTER_CODE.test(event.code)) {
    return event.code.slice(3).toLowerCase();
  }
  if (DIGIT_CODE.test(event.code)) {
    return event.code.slice(5);
  }
  return event.key.toLowerCase();
}

/** The command a key press asks for, or none. */
export function matchShortcut(event: KeyboardEvent): ShortcutCommand | null {
  const mac = isMac();
  const key = keyOf(event);
  const mod = mac ? event.metaKey : event.ctrlKey;
  const control = mac && event.ctrlKey;
  const found = SHORTCUTS.find(
    (shortcut) =>
      shortcut.key === key &&
      Boolean(shortcut.mod) === mod &&
      Boolean(shortcut.control) === control &&
      Boolean(shortcut.shift) === event.shiftKey &&
      Boolean(shortcut.alt) === event.altKey
  );
  return found?.command ?? null;
}
