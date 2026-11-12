/**
 * The ways the elements' examples write their styles, as the customizer
 * lists them: plain CSS on the parts' tags and their data attributes, or
 * Tailwind classes on the parts.
 */
export const STYLINGS = [
  {
    description: "A stylesheet on the parts' tags",
    id: "css",
    label: "CSS",
  },
  {
    description: "Utility classes on the parts",
    id: "tailwind",
    label: "Tailwind",
  },
] as const;

export type Styling = (typeof STYLINGS)[number];
export type StylingId = Styling["id"];

/** What the examples show until the reader chooses: it needs no setup. */
export const DEFAULT_STYLING: StylingId = "css";

export function isStyling(value: unknown): value is StylingId {
  return STYLINGS.some((styling) => styling.id === value);
}

/** How large the examples are drawn: a factor of the spacing unit. */
export const SIZES = [
  {
    description: "Smaller controls",
    factor: 0.85,
    id: "compact",
    label: "Compact",
  },
  {
    description: "The size the examples are written in",
    factor: 1,
    id: "default",
    label: "Default",
  },
  { description: "Larger controls", factor: 1.25, id: "large", label: "Large" },
] as const;

/** How far apart the examples' parts sit: a factor of their gaps. */
export const DENSITIES = [
  {
    description: "Parts close together",
    factor: 0.5,
    id: "tight",
    label: "Tight",
  },
  {
    description: "The gaps the examples are written with",
    factor: 1,
    id: "default",
    label: "Default",
  },
  {
    description: "Parts further apart",
    factor: 1.5,
    id: "roomy",
    label: "Roomy",
  },
] as const;

export type SizeId = (typeof SIZES)[number]["id"];
export type DensityId = (typeof DENSITIES)[number]["id"];

export const isSize = (value: unknown): value is SizeId =>
  SIZES.some((each) => each.id === value);
export const isDensity = (value: unknown): value is DensityId =>
  DENSITIES.some((each) => each.id === value);
