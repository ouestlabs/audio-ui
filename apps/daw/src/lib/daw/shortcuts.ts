/**
 * The keyboard of the workstation (docs/daw-spec/shortcuts.md): the
 * reference's keys, with Cmd on a Mac and Ctrl elsewhere. Chrome keeps Cmd+T
 * and Cmd+Shift+T for its tabs before a page hears them, so Ctrl+T and
 * Ctrl+Shift+T do the same on a Mac.
 */
export type ShortcutCommand =
  | "audio-track"
  | "automation"
  | "continue"
  | "deactivate"
  | "delete"
  | "detail"
  | "duplicate"
  | "export"
  | "fold"
  | "group"
  | "grid-finer"
  | "grid-fixed"
  | "grid-snap"
  | "grid-triplet"
  | "grid-wider"
  | "library"
  | "loop"
  | "midi-track"
  | "mixer"
  | "open"
  | "play-stop"
  | "redo"
  | "return-track"
  | "save"
  | "save-as"
  | "select-all"
  | "solo"
  | "split"
  | "to-start"
  | "undo"
  | "ungroup"
  | "unfold-all"
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
  { command: "open", key: "o", mod: true },
  { command: "save", key: "s", mod: true },
  { command: "save-as", key: "s", mod: true, shift: true },
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
  { command: "automation", key: "a" },
  { command: "fold", key: "u" },
  { command: "group", key: "g", mod: true },
  { command: "ungroup", key: "g", mod: true, shift: true },
  { alt: true, command: "unfold-all", key: "u" },
];

/** The keyboard in words, for the shortcuts menu: what each does, then its keys. */
export const SHORTCUT_HELP: readonly { action: string; keys: string[] }[] = [
  { action: "Play or stop", keys: ["Space"] },
  { action: "Continue from where it stopped", keys: ["Shift", "Space"] },
  { action: "Move the cursor on the grid", keys: ["Left", "Right"] },
  { action: "Go to the start, or the last clip's end", keys: ["Home", "End"] },
  { action: "Pick the track above or below", keys: ["Up", "Down"] },
  { action: "Add a locator at the cursor", keys: ["M"] },
  {
    action: "Jump to the next locator or clip edge",
    keys: ["Option", "Arrows"],
  },
  { action: "Undo", keys: ["Cmd", "Z"] },
  { action: "Redo", keys: ["Cmd", "Shift", "Z"] },
  { action: "Loop the selection", keys: ["Cmd", "L"] },
  { action: "New audio track", keys: ["Ctrl", "T"] },
  { action: "New MIDI track", keys: ["Ctrl", "Shift", "T"] },
  { action: "New return track", keys: ["Cmd", "Option", "T"] },
  { action: "Copy, cut, paste", keys: ["Cmd", "C", "X", "V"] },
  { action: "Duplicate", keys: ["Cmd", "D"] },
  { action: "Split at the cursor", keys: ["Cmd", "E"] },
  { action: "One clip per track of the time selected", keys: ["Cmd", "J"] },
  { action: "Insert silence at the cursor", keys: ["Cmd", "I"] },
  { action: "Fades from the time selected", keys: ["Cmd", "Option", "F"] },
  { action: "Delete what is selected", keys: ["Delete"] },
  { action: "Delete the selected time", keys: ["Cmd", "Shift", "Delete"] },
  { action: "Switch the selected clips off or on", keys: ["0"] },
  { action: "Solo the selected track", keys: ["S"] },
  { action: "Select every clip", keys: ["Cmd", "A"] },
  { action: "Finer or wider grid", keys: ["Cmd", "1", "2"] },
  { action: "Triplets, snapping, a fixed grid", keys: ["Cmd", "3", "4", "5"] },
  { action: "Zoom in or out", keys: ["Cmd", "=", "-"] },
  { action: "Zoom to the selection, and back", keys: ["Z", "X"] },
  { action: "Copy a clip while dragging it", keys: ["Option", "Drag"] },
  { action: "Select clips with a rectangle", keys: ["Shift", "Drag"] },
  { action: "Show or hide the automation", keys: ["A"] },
  { action: "Fold the track, or a group's tracks", keys: ["U"] },
  { action: "Group the selected tracks", keys: ["Cmd", "G"] },
  { action: "Ungroup the selected group", keys: ["Cmd", "Shift", "G"] },
  { action: "Unfold every track", keys: ["Option", "U"] },
  { action: "Fold or show the library", keys: ["Cmd", "Option", "B"] },
  { action: "Show the mixer", keys: ["Cmd", "Option", "M"] },
  { action: "Switch between the clip and the devices", keys: ["Shift", "Tab"] },
  { action: "Export", keys: ["Cmd", "Shift", "R"] },
  { action: "Open a project folder", keys: ["Cmd", "O"] },
  { action: "Save to the project's folder", keys: ["Cmd", "S"] },
  { action: "Save to another folder", keys: ["Cmd", "Shift", "S"] },
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
