import { createElement, type SVGProps } from "react";
import type { Glyph } from "./glyph.ts";

/**
 * How heavy the stroke is, as Phosphor names its weights. `regular` is the
 * thin line, `bold` a thicker one, and `duotone` the line over a tint of the
 * same color: the weight of a current page.
 */
export type IconWeight = "bold" | "duotone" | "regular";

const STROKE_WIDTH: Record<IconWeight, number> = {
  bold: 2.25,
  duotone: 1.5,
  regular: 1.5,
};
const TINT_OPACITY = 0.2;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** The width and height of the icon. @default "1em" */
  size?: number | string;
  /** @default "regular" */
  weight?: IconWeight;
}

/** An icon that draws `glyph` in the current text color. */
export function createIcon(glyph: Glyph, name: string) {
  function GlyphIcon({
    size = "1em",
    weight = "regular",
    ...props
  }: IconProps) {
    const duotone = weight === "duotone";
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={STROKE_WIDTH[weight]}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        {glyph.map((shape) => {
          if (shape.backdrop) {
            return duotone
              ? createElement(shape.tag, {
                  ...shape.attrs,
                  fill: "currentColor",
                  fillOpacity: TINT_OPACITY,
                  key: Object.values(shape.attrs).join(),
                  stroke: "none",
                })
              : null;
          }
          return createElement(shape.tag, {
            ...shape.attrs,
            key: Object.values(shape.attrs).join(),
            ...(duotone && shape.tint
              ? { fill: "currentColor", fillOpacity: TINT_OPACITY }
              : {}),
          });
        })}
      </svg>
    );
  }
  GlyphIcon.displayName = name;
  return GlyphIcon;
}
