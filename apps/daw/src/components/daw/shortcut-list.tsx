import {
  detectPlatform,
  type FormatDisplayOptions,
  formatForDisplay,
  type Hotkey,
  useAppHotkeys,
} from "@tanstack/react-hotkeys";
import { useSyncExternalStore } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { OTHER_KEYS, type ShortcutCommand } from "@/lib/daw/shortcuts";

const noSubscription = () => () => {
  // The platform never changes while the page is open.
};

/** The platform the keys are named for: the server can't tell, so it says ⌘ and the browser corrects it. */
function usePlatform() {
  return useSyncExternalStore<FormatDisplayOptions["platform"]>(
    noSubscription,
    detectPlatform,
    () => "mac"
  );
}

/**
 * The keys a command of the workstation is pressed with now, as text for a
 * menu: the user's own when rebound, named for the platform (⇧⌘S on a Mac,
 * Ctrl+Shift+S elsewhere). Nothing while it is unbound.
 */
export function CommandKeys({ command }: { command: ShortcutCommand }) {
  const platform = usePlatform();
  const { hotkey } = useAppHotkeys()[command];
  return hotkey ? formatForDisplay(hotkey, { platform }) : null;
}

/** One hotkey as keys, as the platform names them: ⌘ and S on a Mac, Ctrl and S elsewhere. */
export function HotkeyKeys({ hotkey }: { hotkey: Hotkey }) {
  const platform = usePlatform();
  const steps = Array.isArray(hotkey) ? hotkey : [hotkey];
  return (
    <KbdGroup>
      {steps.flatMap((step) =>
        formatForDisplay(step, { parts: true, platform }).map((part) => (
          <Kbd key={`${String(step)}-${part}`}>{part}</Kbd>
        ))
      )}
    </KbdGroup>
  );
}

function Row({
  action,
  children,
}: {
  action: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{action}</span>
      <span className="flex items-center gap-1.5">{children}</span>
    </div>
  );
}

/**
 * The keys that are not commands of their own, read only: the keys of the
 * arrangement's parts and the gestures, after the commands the Settings'
 * Shortcuts tab lets the user rebind.
 */
export function OtherShortcuts() {
  return (
    <section aria-label="Also" className="flex flex-col gap-1.5 pb-3 text-sm">
      <h3 className="pb-1 font-medium text-muted-foreground text-xs">Also</h3>
      {OTHER_KEYS.map(({ action, keys }) => (
        <Row action={action} key={action}>
          {typeof keys === "string" ? (
            <span className="text-muted-foreground">{keys}</span>
          ) : (
            keys.map((hotkey) => (
              <HotkeyKeys hotkey={hotkey} key={String(hotkey)} />
            ))
          )}
        </Row>
      ))}
    </section>
  );
}
