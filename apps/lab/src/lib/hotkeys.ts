/**
 * The keys of the lab, in TanStack Hotkeys' notation: `Mod` is ⌘ on a Mac and
 * Ctrl elsewhere. One place says them, and the bar, the command menu, the
 * details panel and the tooltips all read them from here.
 */
export const HOTKEYS = Object.freeze({
  copy: "Mod+C",
  details: "I",
  focus: "F",
  leaveFocus: "Escape",
  navigation: "P",
  search: "Mod+K",
  searchSlash: "/",
  source: "S",
  theme: "D",
});

export type LabHotkey = (typeof HOTKEYS)[keyof typeof HOTKEYS];
