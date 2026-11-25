import { devices } from "@/registry/bases/shared/devices/_registry";

/** The previews that have a Hardware counterpart, by the name of the Digital one. */
export const HARDWARE_DEMOS: Record<string, string> = {
  "fader-vertical-demo": "fader-hardware-demo",
  "knob-demo": "knob-hardware-demo",
  "meter-size-default-demo": "meter-hardware-demo",
};

const PANELS = new Set(devices.map((item) => item.name));

/** A device's block, which wears a skin as it is, inside `HardwareSkin`. */
export const isDevicePreview = (name: string) =>
  name.startsWith("block-") &&
  PANELS.has(`${name.slice("block-".length)}-panel`);

export const isSkinned = (name: string) =>
  isDevicePreview(name) ||
  name in HARDWARE_DEMOS ||
  Object.values(HARDWARE_DEMOS).includes(name);
