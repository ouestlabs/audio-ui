import { type DragEvent, useCallback, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { DeviceBrowser } from "@/registry-audio/bases/base/audio/elements/device-browser";
import { DEVICE_DRAG_TYPE } from "@/registry-audio/bases/base/audio/elements/device-chain";
import { DEVICE_SHELVES } from "@/registry-audio/bases/base/lib/device-library";

const SHELVES = DEVICE_SHELVES.map((shelf) => ({
  items: shelf.devices.map((entry) => entry.device),
  label: shelf.label,
}));

const NAMES = new Map(
  SHELVES.flatMap((shelf) => shelf.items).map((device) => [
    device.id,
    device.name,
  ])
);

/** What a pick or a drop handed back: the device's id, and how it came. */
interface Added {
  how: "dropped" | "picked";
  id: string;
  key: number;
}

/**
 * A library of devices by shelf, with a search. A device is picked with Enter,
 * a double-click or the Add button, or dragged: the library keeps nothing but
 * what is searched and marked, and hands the id back. Here the ids land in a
 * list; in a workstation they go onto a track's chain.
 */
export default function BlockDeviceBrowser() {
  const [added, setAdded] = useState<Added[]>([]);
  const [over, setOver] = useState(false);
  const add = useCallback((id: string, how: Added["how"]) => {
    setAdded((current) => [
      { how, id, key: (current[0]?.key ?? 0) + 1 },
      ...current.slice(0, 7),
    ]);
  }, []);
  const pick = useCallback((id: string) => add(id, "picked"), [add]);
  const dragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (Array.from(event.dataTransfer.types).includes(DEVICE_DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setOver(true);
    }
  }, []);
  const leave = useCallback(() => setOver(false), []);
  const drop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const id = event.dataTransfer.getData(DEVICE_DRAG_TYPE);
      setOver(false);
      if (id) {
        event.preventDefault();
        add(id, "dropped");
      }
    },
    [add]
  );

  return (
    <div className="cn-audio-panel @container/browser flex w-full min-w-0 flex-col overflow-hidden border bg-card @2xl/browser:h-96 @2xl/browser:flex-row">
      <DeviceBrowser
        className="h-80 w-full border-e-0 border-b @2xl/browser:h-auto @2xl/browser:w-auto @2xl/browser:border-e @2xl/browser:border-b-0"
        onPick={pick}
        shelves={SHELVES}
      />
      <section
        aria-label="Devices added"
        className={cn(
          "flex min-h-40 min-w-0 flex-1 flex-col gap-2 bg-muted/30 p-3 text-sm transition-colors",
          over && "bg-primary/10 ring-2 ring-primary ring-inset"
        )}
        onDragLeave={leave}
        onDragOver={dragOver}
        onDrop={drop}
      >
        <p className="text-muted-foreground text-xs">
          What the library hands back. Pick a device, or drag one here.
        </p>
        <ol className="flex flex-col gap-1">
          {added.map(({ how, id, key }) => (
            <li
              className="flex items-baseline gap-2 border-b py-1 last:border-b-0"
              key={key}
            >
              <span className="min-w-0 flex-1 truncate">
                {NAMES.get(id) ?? id}
              </span>
              <span className="text-muted-foreground text-xs">{how}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
