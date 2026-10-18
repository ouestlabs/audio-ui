import { createElement, type ReactNode, type SVGProps, useId } from "react";
import { type DrawnNode, draw } from "../../core/drawing.ts";
import type { Glyph } from "../../core/glyph.ts";
import type { IconWeight } from "../../core/weight.ts";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** The width and height of the icon. @default "1em" */
  size?: number | string;
  /** @default "regular" */
  weight?: IconWeight;
}

function toElement(drawn: DrawnNode, key: number): ReactNode {
  return createElement(
    drawn.tag,
    { ...drawn.attrs, key },
    drawn.children?.map(toElement)
  );
}

/** An icon that draws `glyph` in the current text color. */
export function createIcon(glyph: Glyph, name: string) {
  function GlyphIcon({
    size = "1em",
    weight = "regular",
    ...props
  }: IconProps) {
    const id = `icon-${useId().replaceAll(":", "")}`;
    const { nodes, strokeWidth } = draw(glyph, weight, id);
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        {nodes.map(toElement)}
      </svg>
    );
  }
  GlyphIcon.displayName = name;
  return GlyphIcon;
}
