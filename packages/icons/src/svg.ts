import type { Glyph } from "./glyph.ts";
import { type IconWeight, STROKE_WIDTH, TINT_OPACITY } from "./weight.ts";

const attributes = (attrs: Record<string, number | string>) =>
  Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");

/**
 * The glyph as an SVG file's text, to paste or to save: the same drawing the
 * icon renders, in the current text color.
 */
export function toSvg(
  glyph: Glyph,
  { size = 24, weight = "regular" }: { size?: number; weight?: IconWeight } = {}
): string {
  const duotone = weight === "duotone";
  const tint = `fill="currentColor" fill-opacity="${TINT_OPACITY}"`;
  const shapes = glyph
    .map((shape) => {
      if (shape.backdrop) {
        return duotone
          ? `<${shape.tag}${attributes(shape.attrs)} ${tint} stroke="none"/>`
          : "";
      }
      const extra = duotone && shape.tint ? ` ${tint}` : "";
      return `<${shape.tag}${attributes(shape.attrs)}${extra}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${STROKE_WIDTH[weight]}" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`;
}
