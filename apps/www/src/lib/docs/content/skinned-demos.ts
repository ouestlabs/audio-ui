import type { SkinId } from "@/hooks/use-skin";
import { devices } from "@/registry/bases/shared/devices/_registry";

/** The previews each skin has a counterpart of, by the name of the Digital one. */
export const SKINNED_DEMOS: Record<
  Exclude<SkinId, "digital">,
  Record<string, string>
> = {
  hardware: {
    "fader-vertical-demo": "fader-hardware-demo",
    "knob-demo": "knob-hardware-demo",
    "meter-size-default-demo": "meter-hardware-demo",
  },
  neu: {
    "fader-vertical-demo": "fader-neu-demo",
    "knob-demo": "knob-neu-demo",
    "meter-size-default-demo": "meter-neu-demo",
  },
};

/** The preview a skin draws in place of a Digital one: its counterpart, or the same one. */
export const skinnedDemo = (skin: SkinId, name: string) =>
  skin === "digital" ? name : (SKINNED_DEMOS[skin][name] ?? name);

const PANELS = new Set(devices.map((item) => item.name));

/** A device's block, which wears a skin as it is, inside the skin. */
export const isDevicePreview = (name: string) =>
  name.startsWith("block-") &&
  PANELS.has(`${name.slice("block-".length)}-panel`);

export const isSkinned = (name: string) =>
  isDevicePreview(name) ||
  Object.values(SKINNED_DEMOS).some(
    (demos) => name in demos || Object.values(demos).includes(name)
  );
