import { useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useSyncExternalStore } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEVICES } from "../../devices.ts";

const SOURCE =
  "https://github.com/ouestlabs/audio-ui/tree/main/apps/lab/src/components/devices";
const DOCS = "https://www.audio-ui.dev/docs/components/base";
const DESKTOP_QUERY = "(min-width: 1024px)";

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

function DeviceInfo() {
  const { device: slug } = useParams({ strict: false });
  const device = DEVICES.find((item) => item.slug === slug);

  if (!device) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <h2 className="font-semibold text-sm">Devices</h2>
        <p className="text-muted-foreground text-sm">
          Pick a device in the sidebar: its details are here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-sm">{device.title}</h2>
        <p className="text-muted-foreground text-sm">{device.description}</p>
      </div>
      {device.uses.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs">Built with</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {device.uses.map((name) => (
              <li key={name}>
                <a
                  className="underline-offset-4 hover:underline"
                  href={`${DOCS}/${name}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <a
        className="text-sm underline-offset-4 hover:underline"
        href={`${SOURCE}/${device.slug}`}
        rel="noreferrer"
        target="_blank"
      >
        View the source
      </a>
    </div>
  );
}

/** The device's details, in the aside on the right (from `lg`) or in a sheet below. */
export function DevicePanel({
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
        <SheetContent className="w-full! gap-0" side="right">
          <SheetTitle className="sr-only">Device details</SheetTitle>
          <SheetDescription className="sr-only">
            What the device is and what it is built with.
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
      <div
        className={cn(
          "flex h-full w-64 flex-col",
          open &&
            "fade-in-0 slide-in-from-right-4 animate-in duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
        )}
      >
        <DeviceInfo />
      </div>
    </aside>
  );
}
