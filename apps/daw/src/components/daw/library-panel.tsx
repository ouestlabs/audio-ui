import type { Ref } from "react";
import { DeviceBrowser } from "@/components/audio-ui/device-browser";
import { DEVICE_SHELVES } from "@/lib/device-library";

/** Every device of the library, by shelf, as the browser lists them. */
const SHELVES = DEVICE_SHELVES.map((shelf) => ({
  items: shelf.devices.map((entry) => entry.device),
  label: shelf.label,
}));

/**
 * The library, down the left side of the workstation (KEY-021 shows or folds
 * it): every device by shelf, searched as you type. A device picked goes on
 * the selected track, or on a track of its own (DEV-003); dragged, it goes
 * where it is dropped, on a track, on the add-track row or into the chain of
 * the device view.
 */
export function LibraryPanel({
  onOpenChange,
  onPick,
  open,
  searchRef,
}: {
  onOpenChange: (open: boolean) => void;
  onPick: (device: string) => void;
  open: boolean;
  searchRef: Ref<HTMLInputElement>;
}) {
  return (
    <DeviceBrowser
      className="h-full"
      onOpenChange={onOpenChange}
      onPick={onPick}
      open={open}
      searchRef={searchRef}
      shelves={SHELVES}
    />
  );
}
