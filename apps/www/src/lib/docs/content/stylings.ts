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
