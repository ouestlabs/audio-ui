import {
  detectPlatform,
  type FormatDisplayOptions,
  formatForDisplay,
} from "@tanstack/react-hotkeys";
import { useSyncExternalStore } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { LabHotkey } from "@/lib/hotkeys";

const noSubscription = () => () => {
  // The platform never changes while the page is open.
};

/** A hotkey drawn as keys, in what the platform calls them: ⌘ and K on a Mac, Ctrl and K elsewhere. */
export function HotkeyKbd({
  className,
  hotkey,
}: {
  className?: string;
  hotkey: LabHotkey;
}) {
  // TanStack detects the platform in the browser. The server cannot, so the page it renders says ⌘ and the browser corrects it, with no hydration mismatch.
  const platform = useSyncExternalStore<FormatDisplayOptions["platform"]>(
    noSubscription,
    detectPlatform,
    () => "mac"
  );
  const parts = formatForDisplay(hotkey, { parts: true, platform });
  return (
    <KbdGroup>
      {parts.map((part) => (
        <Kbd className={className} key={part}>
          {part}
        </Kbd>
      ))}
    </KbdGroup>
  );
}
