import type { SkinId } from "@/hooks/use-skin";
import type { ShadowSkin } from "@/lib/registry/core/mount-styled";
import { devices } from "@/registry/bases/shared/devices/_registry";

/** The elements a skin dresses, in every framework: a preview of one wears the skin chosen. */
const SKINNABLE = /^(knob|fader|meter|xypad|envelope|pad|piano)-(?!roll)/;

export const isSkinnable = (name: string) => SKINNABLE.test(name);

const PANELS = new Set(devices.map((item) => item.name));

/** A device's block, which wears a skin as it is, inside the skin. */
export const isDevicePreview = (name: string) =>
  name.startsWith("block-") &&
  PANELS.has(`${name.slice("block-".length)}-panel`);

/** The plate a preview wears its skin on, in React: as wide as the preview, what it holds in its middle. */
export const skinFrameClass = (skin: Exclude<SkinId, "digital">) =>
  `skin-${skin} audio-body flex w-full items-center justify-center rounded-2xl px-10 py-8`;

/** The same plate in a shadow root, with the skin's sheet and the axes the reader set, which the page's own rule cannot reach there. */
export function shadowSkin(
  skin: SkinId,
  axes: readonly (readonly [property: string, css: string])[]
): ShadowSkin | undefined {
  if (skin === "digital") {
    return;
  }
  return {
    className: `skin-${skin} audio-body`,
    sheet: `/css/skins/${skin}.css`,
    style: [
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "width: 100%",
      "padding: 2rem 2.5rem",
      "border-radius: 1rem",
      ...axes.map(([property, css]) => `${property}: ${css}`),
    ].join("; "),
  };
}
