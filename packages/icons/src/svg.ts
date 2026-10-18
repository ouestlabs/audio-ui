import { type DrawnNode, draw } from "./drawing.ts";
import type { Glyph } from "./glyph.ts";
import type { IconWeight } from "./weight.ts";

const KEBAB = /[A-Z]/g;
// A short fingerprint of the shapes, so the mask of an icon has a name of its own.
const fingerprint = (glyph: Glyph) => {
  let hash = 0;
  for (const char of JSON.stringify(glyph)) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const serialize = (drawn: DrawnNode): string => {
  const attrs = Object.entries(drawn.attrs)
    .map(
      ([name, value]) =>
        ` ${name.replace(KEBAB, (c) => `-${c.toLowerCase()}`)}="${value}"`
    )
    .join("");
  return drawn.children
    ? `<${drawn.tag}${attrs}>${drawn.children.map(serialize).join("")}</${drawn.tag}>`
    : `<${drawn.tag}${attrs}/>`;
};

/**
 * The glyph as an SVG file's text, to paste or to save: the same drawing the
 * icon renders, in the current text color.
 */
export function toSvg(
  glyph: Glyph,
  { size = 24, weight = "regular" }: { size?: number; weight?: IconWeight } = {}
): string {
  const { nodes, strokeWidth } = draw(
    glyph,
    weight,
    `icon-${fingerprint(glyph)}`
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${nodes.map(serialize).join("")}</svg>`;
}
