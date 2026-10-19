import { ArrowUpRightIcon, CodeIcon } from "@phosphor-icons/react/ssr";
import { useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useCallback, useSyncExternalStore } from "react";
import { HotkeyKbd } from "@/components/site/hotkey-kbd";
import { useLab } from "@/components/site/providers/lab-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEVICES } from "@/lib/devices";
import { HOTKEYS } from "@/lib/hotkeys";

const DOCS = "https://www.audio-ui.dev/docs/components/base";
const DESKTOP_QUERY = "(min-width: 1024px)";

/** The keys of the frame, as the bar and the command menu give them. */
const SHORTCUTS = [
  { hotkey: HOTKEYS.search, label: "Search" },
  { hotkey: HOTKEYS.navigation, label: "Navigation" },
  { hotkey: HOTKEYS.details, label: "Details" },
  { hotkey: HOTKEYS.focus, label: "Focus on the device" },
  { hotkey: HOTKEYS.source, label: "View the source" },
  { hotkey: HOTKEYS.theme, label: "Theme" },
] as const;

function subscribe(callback: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Whether the panel is an aside (from `lg`) or a sheet: the two never show together. */
function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
      {children}
    </section>
  );
}

function Shortcuts() {
  return (
    <Section title="Shortcuts">
      <ul className="flex flex-col gap-1.5 text-sm">
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
    </Section>
  );
}

/** What the panel says about the device on screen: what it is, what it is made of, how to read it. */
function DeviceInfo() {
  const { setSourceOpen } = useLab().actions;
  const openSource = useCallback(() => setSourceOpen(true), [setSourceOpen]);
  const { device: slug } = useParams({ strict: false });
  const device = DEVICES.find((item) => item.slug === slug);

  // pt-5: the first line sits on the middle of the frame bar beside it, not on the edge of the viewport.
  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm">{device?.title ?? "Lab"}</h3>
        <p className="text-muted-foreground text-sm">
          {device?.description ??
            "Pick a device: what it is and what it is made of are here."}
        </p>
      </div>
      {device && device.uses.length > 0 ? (
        <Section title="Built with">
          <ul className="flex flex-col gap-0.5">
            {device.uses.map((name) => (
              <li key={name}>
                <a
                  className="group/link flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  href={`${DOCS}/${name}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {name}
                  <ArrowUpRightIcon
                    aria-hidden
                    className="text-muted-foreground"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Shortcuts />
      {device ? (
        <Button onClick={openSource} variant="outline">
          <CodeIcon aria-hidden />
          View the source
        </Button>
      ) : null}
    </div>
  );
}

/** The device's details: a full-height aside on the right (from `lg`), a sheet below, as the docs' customizer is. */
export function DetailsPanel({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="w-full! gap-0 overflow-y-auto" side="right">
          <SheetTitle className="sr-only">Details</SheetTitle>
          <SheetDescription className="sr-only">
            What the device is, what it is made of and the keys of the frame.
          </SheetDescription>
          <DeviceInfo />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-hidden lg:flex",
        !open && "w-0"
      )}
      inert={!open}
    >
      {/* The width changes at once, so the page is laid out once; what is shown eases in. */}
      <div
        className={cn(
          "flex h-full w-64 flex-col",
          open &&
            "fade-in-0 slide-in-from-right-4 animate-in duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
        )}
      >
        <div className="slim-scroll min-h-0 flex-1 overflow-y-auto">
          <DeviceInfo />
        </div>
      </div>
    </aside>
  );
}
