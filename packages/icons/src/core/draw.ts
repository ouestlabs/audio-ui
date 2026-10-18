import {
  type Glyph,
  type IconWeight,
  type Shape,
  STROKE_WIDTH,
  TINT_OPACITY,
} from "./glyph.ts";

/** One element of the drawing, as plain data: a React icon and an SVG file both read it. */
export interface DrawnNode {
  attrs: Record<string, number | string>;
  children?: DrawnNode[];
  tag: string;
}

const node = (
  tag: string,
  attrs: Record<string, number | string>,
  children?: DrawnNode[]
): DrawnNode => ({ attrs, children, tag });

const of = (shape: Shape, extra: Record<string, number | string> = {}) =>
  node(shape.tag, { ...shape.attrs, ...extra });

/** A line glyph has no body to fill: its solid weight is the bold line. */
const hasBody = (glyph: Glyph) =>
  glyph.some((shape) => shape.tint || shape.backdrop);

/**
 * What a glyph draws in a weight, and the stroke it is drawn with. The fill
 * weight is the glyph's closed shapes, solid, with its knock details cut out
 * through a mask: `id` names the mask.
 */
function drawShapes(
  glyph: Glyph,
  weight: IconWeight,
  id: string,
  whole: Glyph = glyph
) {
  if (weight === "fill" && hasBody(whole)) {
    const solid = glyph
      .filter((shape) => shape.tint || shape.backdrop)
      .map((shape) =>
        of(shape, {
          fill: "currentColor",
          ...(shape.backdrop ? { stroke: "none" } : {}),
        })
      );
    const cuts = glyph.filter((shape) => shape.knock);
    const lines = glyph.filter(
      (shape) => !(shape.tint || shape.backdrop || shape.knock)
    );
    const nodes: DrawnNode[] = [];
    if (cuts.length > 0) {
      nodes.push(
        node(
          "mask",
          {
            height: 24,
            id,
            maskUnits: "userSpaceOnUse",
            width: 24,
            x: 0,
            y: 0,
          },
          [
            node("rect", {
              fill: "white",
              height: 24,
              stroke: "none",
              width: 24,
            }),
            ...cuts.map((shape) =>
              of(shape, {
                // A closed detail is cut out whole; a line is cut as drawn.
                ...(shape.tag === "path" ? {} : { fill: "black" }),
                stroke: "black",
              })
            ),
          ]
        ),
        node("g", { mask: `url(#${id})` }, solid)
      );
    } else {
      nodes.push(...solid);
    }
    nodes.push(...lines.map((shape) => of(shape)));
    return { nodes, strokeWidth: STROKE_WIDTH.fill };
  }
  const duotone = weight === "duotone";
  const tint = { fill: "currentColor", fillOpacity: TINT_OPACITY };
  const nodes = glyph.flatMap((shape) => {
    if (shape.backdrop) {
      return duotone ? [of(shape, { ...tint, stroke: "none" })] : [];
    }
    return [of(shape, duotone && shape.tint ? tint : {})];
  });
  return {
    nodes,
    strokeWidth: weight === "fill" ? STROKE_WIDTH.bold : STROKE_WIDTH[weight],
  };
}

/** The air left between a shape that sits on a line and the line that stops short of it. */
const GAP = 1.25;

/**
 * What a glyph draws in a weight, and the stroke it is drawn with. The shapes
 * that sit on a line are drawn over it, and the line is masked out around
 * them: in every weight, no stroke crosses their outline.
 */
export function draw(whole: Glyph, weight: IconWeight, id: string) {
  const glyph = whole.filter(
    (shape) => !shape.weights || shape.weights.includes(weight)
  );
  const overs = glyph.filter((shape) => shape.over);
  if (overs.length === 0) {
    return drawShapes(glyph, weight, id);
  }
  const rest = drawShapes(
    glyph.filter((shape) => !shape.over),
    weight,
    id,
    glyph
  );
  const above = drawShapes(overs, weight, `${id}-over`, glyph);
  const maskId = `${id}-clear`;
  const clear = node(
    "mask",
    {
      height: 24,
      id: maskId,
      maskUnits: "userSpaceOnUse",
      width: 24,
      x: 0,
      y: 0,
    },
    [
      node("rect", { fill: "white", height: 24, stroke: "none", width: 24 }),
      ...overs.map((shape) =>
        of(shape, {
          fill: "black",
          stroke: "black",
          strokeWidth: rest.strokeWidth + 2 * GAP,
        })
      ),
    ]
  );
  return {
    nodes: [
      clear,
      node("g", { mask: `url(#${maskId})` }, rest.nodes),
      ...above.nodes,
    ],
    strokeWidth: rest.strokeWidth,
  };
}

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
