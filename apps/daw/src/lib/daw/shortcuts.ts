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
  | "record"
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

import {
  matchesKeyboardEvent,
  parseHotkey,
  type RawHotkeyChord,
} from "@tanstack/react-hotkeys";

/** A key of the workstation: the command it runs, and the chord it is pressed with. */
export interface Shortcut {
  /**
   * The chord, as the hotkeys library reads it: `mod` is Cmd on a Mac and Ctrl
   * elsewhere. A letter is read by its name, and by where it sits when Option
   * changes it on a Mac; a digit by where it sits (its `code`), as a layout
   * such as AZERTY reaches the digits with Shift.
   */
  chord: RawHotkeyChord;
  command: ShortcutCommand;
  /** Only on a Mac: Ctrl itself, standing in for a key the browser keeps there. */
  mac?: boolean;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { chord: { key: " " }, command: "play-stop" },
  { chord: { key: " ", shift: true }, command: "continue" },
  { chord: { key: "F9" }, command: "record" },
  { chord: { key: "Home" }, command: "to-start" },
  { chord: { key: "L", mod: true }, command: "loop" },
  { chord: { key: "Z", mod: true }, command: "undo" },
  { chord: { key: "Z", mod: true, shift: true }, command: "redo" },
  { chord: { key: "Y", mod: true }, command: "redo" },
  { chord: { key: "T", mod: true }, command: "audio-track" },
  {
    chord: { key: "T", ctrl: true },
    command: "audio-track",
    mac: true,
  },
  {
    chord: { key: "T", mod: true, shift: true },
    command: "midi-track",
  },
  {
    chord: { key: "T", ctrl: true, shift: true },
    command: "midi-track",
    mac: true,
  },
  {
    chord: { alt: true, key: "T", mod: true },
    command: "return-track",
  },
  { chord: { key: "Delete" }, command: "delete" },
  { chord: { key: "Backspace" }, command: "delete" },
  { chord: { key: "E", mod: true }, command: "split" },
  { chord: { key: "D", mod: true }, command: "duplicate" },
  { chord: { key: "0" }, command: "deactivate" },
  { chord: { code: "Digit0" }, command: "deactivate" },
  { chord: { key: "S" }, command: "solo" },
  { chord: { key: "A", mod: true }, command: "select-all" },
  { chord: { alt: true, key: "M", mod: true }, command: "mixer" },
  { chord: { alt: true, key: "B", mod: true }, command: "library" },
  { chord: { key: "Tab", shift: true }, command: "detail" },
  { chord: { key: "R", mod: true, shift: true }, command: "export" },
  { chord: { key: "O", mod: true }, command: "open" },
  { chord: { key: "S", mod: true }, command: "save" },
  { chord: { key: "S", mod: true, shift: true }, command: "save-as" },
  { chord: { code: "Digit1", mod: true }, command: "grid-finer" },
  { chord: { code: "Digit2", mod: true }, command: "grid-wider" },
  { chord: { code: "Digit3", mod: true }, command: "grid-triplet" },
  { chord: { code: "Digit4", mod: true }, command: "grid-snap" },
  { chord: { code: "Digit5", mod: true }, command: "grid-fixed" },
  { chord: { key: "=", mod: true }, command: "zoom-in" },
  { chord: { key: "+", mod: true }, command: "zoom-in" },
  { chord: { key: "-", mod: true }, command: "zoom-out" },
  { chord: { key: "Z" }, command: "zoom-selection" },
  { chord: { key: "X" }, command: "zoom-back" },
  { chord: { key: "A" }, command: "automation" },
  { chord: { key: "U" }, command: "fold" },
  { chord: { key: "G", mod: true }, command: "group" },
  { chord: { key: "G", mod: true, shift: true }, command: "ungroup" },
  { chord: { alt: true, key: "U" }, command: "unfold-all" },
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

/** The platform `mod` is read for: Cmd on a Mac, Ctrl elsewhere. */
export const platformOf = (): "mac" | "windows" =>
  typeof navigator !== "undefined" && APPLE.test(navigator.platform)
    ? "mac"
    : "windows";

/** The keys of this platform: a Mac adds what stands in for the keys its browser keeps. */
export function platformShortcuts(): readonly Shortcut[] {
  const mac = platformOf() === "mac";
  return SHORTCUTS.filter((shortcut) => mac || !shortcut.mac);
}

/** The command a key press asks for, or none. */
export function matchShortcut(event: KeyboardEvent): ShortcutCommand | null {
  const platform = platformOf();
  const found = platformShortcuts().find((shortcut) =>
    matchesKeyboardEvent(event, parseHotkey(shortcut.chord, platform), platform)
  );
  return found?.command ?? null;
}
