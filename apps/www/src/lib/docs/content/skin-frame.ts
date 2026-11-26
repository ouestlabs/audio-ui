import type { SkinId } from "@/hooks/use-skin";
import type { ShadowSkin } from "@/lib/registry/core/mount-styled";
import { devices } from "@/registry/bases/shared/devices/_registry";

/** The elements a skin dresses, in every framework: a preview of one wears the skin chosen. */
const SKINNABLE = /^(knob|fader|meter|xypad|envelope|pad|piano)-(?!roll)/;

export const isSkinnable = (name: string) => SKINNABLE.test(name);

/** The elements as wide as their place: their plate is too. Every other plate holds its element and no more. */
const FULL_WIDTH = /^(?:envelope|piano)-/;

const fullWidth = (name: string) => FULL_WIDTH.test(name);

const PANELS = new Set(devices.map((item) => item.name));

/** A device's block, which wears a skin as it is, inside the skin. */
export const isDevicePreview = (name: string) =>
  name.startsWith("block-") &&
  PANELS.has(`${name.slice("block-".length)}-panel`);

/** The plate a preview wears its skin on, in React: as wide as what it holds, a demo of a full-width element as wide as the preview. */
export const skinFrameClass = (skin: Exclude<SkinId, "digital">, name = "") =>
  `skin-${skin} audio-body flex items-center justify-center rounded-2xl px-10 py-8${fullWidth(name) ? " w-full" : ""}`;

/** The same plate in a shadow root, sized the same, with the skin's sheet and the axes the reader set, which the page's own rule cannot reach there. */
export function shadowSkin(
  skin: SkinId,
  axes: readonly (readonly [property: string, css: string])[],
  name = ""
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
      ...(fullWidth(name) ? ["width: 100%"] : []),
      "padding: 2rem 2.5rem",
      "border-radius: 1rem",
      ...axes.map(([property, css]) => `${property}: ${css}`),
    ].join("; "),
  };
}
