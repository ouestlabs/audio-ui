import type { ReactNode } from "react";
import { lazyComponent } from "@/lib/lazy";

/** What one control does, written in the page: it goes in the row of the control with the same `id`. */
export function Control(_props: { children: ReactNode; id: string }) {
  return null;
}

// Loaded on a device's page only: its rows read every device's description, and with them their engines.
export const DeviceControls = lazyComponent(() =>
  import("@/components/preview/controls/device-controls-table").then(
    (module) => module.DeviceControlsTable
  )
);
