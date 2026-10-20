import { ArrowUpRightIcon, CodeIcon } from "@phosphor-icons/react/ssr";
import { useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useCallback, useSyncExternalStore } from "react";
import { Midi } from "@/components/site/details/midi";
import { Output } from "@/components/site/details/output";
import { Patch } from "@/components/site/details/patch";
import { useLab } from "@/components/site/providers/lab-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEVICES } from "@/lib/devices";
import { useInspector } from "@/lib/inspector";

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

/** What the panel shows of the device on screen: what it is, then its sound, its MIDI and its patch, live, and what it is made of. */
function Inspector() {
  const { setSourceOpen } = useLab().actions;
  const openSource = useCallback(() => setSourceOpen(true), [setSourceOpen]);
  const { device: slug } = useParams({ strict: false });
  const device = DEVICES.find((item) => item.slug === slug);
  const { output, patch } = useInspector();

  // pt-5: the first line sits on the middle of the frame bar beside it, not on the edge of the viewport.
  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm">{device?.title ?? "Lab"}</h3>
        <p className="text-muted-foreground text-sm">
          {device?.description ??
            "Pick a device: what it plays is seen here, live."}
        </p>
      </div>
      {output ? (
        <Section title="Output">
          <Output output={output} />
        </Section>
      ) : null}
      <Section title="MIDI">
        <Midi />
      </Section>
      {patch ? (
        <Section title="Patch">
          <Patch patch={patch} />
        </Section>
      ) : null}
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
  sheetOpen,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Whether the sheet is open on a narrow screen: only once it was asked for in this visit. */
  sheetOpen: boolean;
}) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <Sheet onOpenChange={onOpenChange} open={sheetOpen}>
        <SheetContent className="w-full! gap-0 overflow-y-auto" side="right">
          <SheetTitle className="sr-only">Details</SheetTitle>
          <SheetDescription className="sr-only">
            What the device is playing, live, and what it is made of.
          </SheetDescription>
          <Inspector />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "details-aside sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-hidden lg:flex",
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
          <Inspector />
        </div>
      </div>
    </aside>
  );
}
