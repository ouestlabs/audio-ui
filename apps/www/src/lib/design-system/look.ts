import { createKeptChoice } from "@/hooks/use-kept-choice";

/** A value an axis of a skin takes, as the Look offers it. */
export interface LookOption {
  /** The CSS value the axis is set to. */
  css: string;
  id: string;
  label: string;
}

/** The materials a skin can be made of: `--audio-shade`. A dark one turns the skin dark. */
export const SHADES: readonly LookOption[] = [
  { css: "oklch(0.96 0.003 250)", id: "chalk", label: "Chalk" },
  { css: "oklch(0.94 0.012 85)", id: "paper", label: "Paper" },
  { css: "oklch(0.86 0.03 75)", id: "sand", label: "Sand" },
  { css: "oklch(0.62 0.06 60)", id: "bronze", label: "Bronze" },
  { css: "oklch(0.32 0.006 250)", id: "graphite", label: "Graphite" },
  { css: "oklch(0.22 0.012 265)", id: "ink", label: "Ink" },
];

/** The colors of the value: `--audio-accent`. */
export const ACCENTS: readonly LookOption[] = [
  { css: "oklch(0.64 0.19 38)", id: "vermilion", label: "Vermilion" },
  { css: "oklch(0.76 0.16 70)", id: "amber", label: "Amber" },
  { css: "oklch(0.78 0.18 130)", id: "lime", label: "Lime" },
  { css: "oklch(0.66 0.12 190)", id: "teal", label: "Teal" },
  { css: "oklch(0.6 0.17 255)", id: "blue", label: "Blue" },
  { css: "oklch(0.6 0.2 295)", id: "violet", label: "Violet" },
];

const steps = (label: (value: number) => string) =>
  [0, 0.5, 1, 1.5, 2].map((value) => ({
    css: String(value),
    id: String(value),
    label: label(value),
  }));

/** How far parts stand out of the surface: `--audio-depth`. */
export const DEPTHS: readonly LookOption[] = steps((value) =>
  value === 0 ? "Flat" : `${value}×`
);

/** How round the skin's corners are: `--audio-roundness`. */
export const ROUNDNESSES: readonly LookOption[] = steps((value) =>
  value === 0 ? "Square" : `${value}×`
);

/** Each axis, by its CSS variable, with its options and the choice the reader keeps. */
export const AXES = {
  "--audio-accent": { label: "Accent", options: ACCENTS, param: "accent" },
  "--audio-depth": { label: "Depth", options: DEPTHS, param: "depth" },
  "--audio-roundness": {
    label: "Roundness",
    options: ROUNDNESSES,
    param: "roundness",
  },
  "--audio-shade": { label: "Shade", options: SHADES, param: "shade" },
} as const;

export type Axis = keyof typeof AXES;

/** The axes in the order the Look lists them: the material first. */
export const AXIS_ORDER: readonly Axis[] = [
  "--audio-shade",
  "--audio-accent",
  "--audio-depth",
  "--audio-roundness",
];

export const axisChoices = Object.fromEntries(
  Object.entries(AXES).map(([axis, { options, param }]) => [
    axis,
    createKeptChoice<string>({
      isValid: (value): value is string =>
        typeof value === "string" &&
        options.some((option) => option.id === value),
      key: `audio-ui-look-${param}`,
      param,
    }),
  ])
) as Record<Axis, ReturnType<typeof createKeptChoice<string>>>;

/** The axes a reader chose, as CSS declarations: what a skin's element takes over its own. */
export function lookDeclarations(chosen: Partial<Record<Axis, string | null>>) {
  return AXIS_ORDER.flatMap((axis) => {
    const option = AXES[axis].options.find((each) => each.id === chosen[axis]);
    return option ? [`${axis}: ${option.css};`] : [];
  });
}
