import { HotkeyKbd } from "@/components/site/hotkey-kbd";
import { HOTKEYS } from "@/lib/hotkeys";

/** The keys of the frame, as the bar and the command menu give them. The search is the button above the list. */
const SHORTCUTS = [
  { hotkey: HOTKEYS.navigation, label: "Navigation" },
  { hotkey: HOTKEYS.details, label: "Details" },
  { hotkey: HOTKEYS.focus, label: "Focus on the device" },
  { hotkey: HOTKEYS.source, label: "View the source" },
  { hotkey: HOTKEYS.theme, label: "Theme" },
] as const;

/** What the keys do, at the foot of the sidebar. */
export function Shortcuts() {
  return (
    <section aria-label="Shortcuts" className="flex flex-col gap-2 px-2 pb-1">
      <h3 className="font-medium text-muted-foreground text-xs">Shortcuts</h3>
      <ul className="flex flex-col gap-1.5 text-muted-foreground text-xs">
        {SHORTCUTS.map((shortcut) => (
          <li
            className="flex items-center justify-between gap-2"
            key={shortcut.label}
          >
            {shortcut.label}
            <HotkeyKbd className="border" hotkey={shortcut.hotkey} />
          </li>
        ))}
      </ul>
    </section>
  );
}
