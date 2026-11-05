import {
  type CustomHotkeys,
  defineAppHotkeys,
  detectPlatform,
  type Hotkey,
  matchesKeyboardEvent,
  parseHotkey,
  type RegisterableHotkeyChord,
} from "@tanstack/react-hotkeys";

/**
 * The keyboard of the workstation (docs/daw-spec/shortcuts.md), declared once
 * as TanStack Hotkeys app hotkeys: each command has an id, a name and a group,
 * which the shortcuts menu lists, and a default the user may rebind. `Mod` is
 * Cmd on a Mac and Ctrl elsewhere. Chrome keeps Cmd+T and Cmd+Shift+T for its
 * tabs before a page hears them, so a new track is Ctrl+T on every system.
 *
 * A letter is read by its name, and by where it sits when Option changes it on
 * a Mac; a digit by where it sits (`[Digit1]`), as a layout such as AZERTY
 * reaches the digits with Shift.
 */
export const APP_HOTKEYS = defineAppHotkeys({
  continue: {
    hotkey: "Shift+Space",
    meta: { group: "Transport", name: "Continue from where it stopped" },
  },
  "play-stop": {
    hotkey: "Space",
    meta: { group: "Transport", name: "Play or stop" },
  },
  record: { hotkey: "F9", meta: { group: "Transport", name: "Record" } },
  "to-start": {
    hotkey: "Home",
    meta: { group: "Transport", name: "Go to the start" },
  },
  loop: {
    hotkey: "Mod+L",
    meta: { group: "Transport", name: "Loop the selection" },
  },
  undo: { hotkey: "Mod+Z", meta: { group: "Edit", name: "Undo" } },
  redo: { hotkey: "Mod+Shift+Z", meta: { group: "Edit", name: "Redo" } },
  duplicate: { hotkey: "Mod+D", meta: { group: "Edit", name: "Duplicate" } },
  split: {
    hotkey: "Mod+E",
    meta: { group: "Edit", name: "Split at the cursor" },
  },
  delete: {
    hotkey: "Delete",
    meta: { group: "Edit", name: "Delete what is selected" },
  },
  deactivate: {
    hotkey: "0",
    meta: { group: "Edit", name: "Switch the selected clips off or on" },
  },
  "select-all": {
    hotkey: "Mod+A",
    meta: { group: "Edit", name: "Select every clip" },
  },
  "audio-track": {
    hotkey: "Control+T",
    meta: { group: "Tracks", name: "New audio track" },
  },
  "midi-track": {
    hotkey: "Control+Shift+T",
    meta: { group: "Tracks", name: "New MIDI track" },
  },
  "return-track": {
    hotkey: "Mod+Alt+T",
    meta: { group: "Tracks", name: "New return track" },
  },
  solo: {
    hotkey: "S",
    meta: { group: "Tracks", name: "Solo the selected track" },
  },
  fold: {
    hotkey: "U",
    meta: { group: "Tracks", name: "Fold the track, or a group's tracks" },
  },
  "unfold-all": {
    hotkey: "Alt+U",
    meta: { group: "Tracks", name: "Unfold every track" },
  },
  group: {
    hotkey: "Mod+G",
    meta: { group: "Tracks", name: "Group the selected tracks" },
  },
  ungroup: {
    hotkey: "Mod+Shift+G",
    meta: { group: "Tracks", name: "Ungroup the selected group" },
  },
  automation: {
    hotkey: "A",
    meta: { group: "Tracks", name: "Show or hide the automation" },
  },
  "grid-finer": {
    hotkey: "Mod+[Digit1]",
    meta: { group: "Grid and zoom", name: "Finer grid" },
  },
  "grid-wider": {
    hotkey: "Mod+[Digit2]",
    meta: { group: "Grid and zoom", name: "Wider grid" },
  },
  "grid-triplet": {
    hotkey: "Mod+[Digit3]",
    meta: { group: "Grid and zoom", name: "Triplets" },
  },
  "grid-snap": {
    hotkey: "Mod+[Digit4]",
    meta: { group: "Grid and zoom", name: "Snap to the grid" },
  },
  "grid-fixed": {
    hotkey: "Mod+[Digit5]",
    meta: { group: "Grid and zoom", name: "A fixed grid" },
  },
  "zoom-in": {
    hotkey: "Mod+=",
    meta: { group: "Grid and zoom", name: "Zoom in" },
  },
  "zoom-out": {
    hotkey: "Mod+-",
    meta: { group: "Grid and zoom", name: "Zoom out" },
  },
  "zoom-selection": {
    hotkey: "Z",
    meta: { group: "Grid and zoom", name: "Zoom to the selection" },
  },
  "zoom-back": {
    hotkey: "X",
    meta: { group: "Grid and zoom", name: "Zoom back" },
  },
  library: {
    hotkey: "Mod+Alt+B",
    meta: { group: "View", name: "Fold or show the library" },
  },
  mixer: {
    hotkey: "Mod+Alt+M",
    meta: { group: "View", name: "Show the mixer" },
  },
  detail: {
    hotkey: "Shift+Tab",
    meta: { group: "View", name: "Switch between the clip and the devices" },
  },
  export: {
    hotkey: "Mod+Shift+R",
    meta: { group: "Project", name: "Export" },
  },
  open: {
    hotkey: "Mod+O",
    meta: { group: "Project", name: "Open a project folder" },
  },
  save: {
    hotkey: "Mod+S",
    meta: { group: "Project", name: "Save to the project's folder" },
  },
  "save-as": {
    hotkey: "Mod+Shift+S",
    meta: { group: "Project", name: "Save to another folder" },
  },
});

declare module "@tanstack/react-hotkeys" {
  interface Register {
    appHotkeys: typeof APP_HOTKEYS;
  }
}

/** What a key of the workstation runs: the id of one of its app hotkeys. */
export type ShortcutCommand = keyof typeof APP_HOTKEYS;

/** Second keys for a command, as a DAW has them: they run it too, and stay as they are when it is rebound. */
export const ALSO_HOTKEYS: readonly {
  command: ShortcutCommand;
  hotkey: RegisterableHotkeyChord;
}[] = [
  { command: "redo", hotkey: "Mod+Y" },
  { command: "delete", hotkey: "Backspace" },
  // `0` by where it sits, for a layout that reaches it with Shift.
  { command: "deactivate", hotkey: "[Digit0]" },
  // `+` where a layout has it of its own, or on the numeric pad.
  { command: "zoom-in", hotkey: { key: "+", mod: true } },
];

/**
 * Keys the arrangement's own parts take before the app hotkeys (the cursor,
 * the time selected, the clipboard), and gestures: listed in the shortcuts
 * menu beside them, they are not rebound here.
 */
export const OTHER_KEYS: readonly {
  action: string;
  /** Keys, drawn for the platform; or a gesture, in words. */
  keys: readonly Hotkey[] | string;
}[] = [
  { action: "Move the cursor on the grid", keys: ["ArrowLeft", "ArrowRight"] },
  { action: "Go to the last clip's end", keys: ["End"] },
  { action: "Pick the track above or below", keys: ["ArrowUp", "ArrowDown"] },
  { action: "Add a locator at the cursor", keys: ["M"] },
  {
    action: "Jump to the next locator or clip edge",
    keys: ["Alt+ArrowLeft", "Alt+ArrowRight"],
  },
  { action: "Copy, cut, paste", keys: ["Mod+C", "Mod+X", "Mod+V"] },
  { action: "One clip per track of the time selected", keys: ["Mod+J"] },
  { action: "Insert silence at the cursor", keys: ["Mod+I"] },
  { action: "Fades from the time selected", keys: ["Mod+Alt+F"] },
  { action: "Delete the selected time", keys: ["Mod+Shift+Delete"] },
  { action: "Copy a clip while dragging it", keys: "Option and drag" },
  { action: "Select clips with a rectangle", keys: "Shift and drag" },
];

const KEPT = "audio-ui-daw:hotkeys";

/** The keys the user rebound, kept in this browser: only what differs from the defaults. */
export function readCustomHotkeys(): CustomHotkeys {
  try {
    return JSON.parse(localStorage.getItem(KEPT) ?? "{}") as CustomHotkeys;
  } catch {
    return {};
  }
}

export function keepCustomHotkeys(custom: CustomHotkeys) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(custom));
  } catch {
    // Refused: the rebound keys just won't come back.
  }
}

/** The platform `mod` is read for: Cmd on a Mac, Ctrl elsewhere. */
export const platformOf = () => detectPlatform();

/** The command a key press asks for by the default keys, or none: what a test reads. */
export function matchShortcut(event: KeyboardEvent): ShortcutCommand | null {
  const platform = platformOf();
  const chords: [ShortcutCommand, RegisterableHotkeyChord][] = [
    ...Object.values(APP_HOTKEYS).map(
      (hotkey) =>
        [hotkey.id, hotkey.defaultHotkey] as [
          ShortcutCommand,
          RegisterableHotkeyChord,
        ]
    ),
    ...ALSO_HOTKEYS.map(
      ({ command, hotkey }) =>
        [command, hotkey] as [ShortcutCommand, RegisterableHotkeyChord]
    ),
  ];
  const found = chords.find(([, chord]) =>
    matchesKeyboardEvent(event, parseHotkey(chord, platform), platform)
  );
  return found?.[0] ?? null;
}
