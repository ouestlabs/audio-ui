/**
 * The examples of a primitive's page, under Examples: each a variation of the
 * page's usage, told by the props it gives the root. The live preview takes
 * the same props and the code shows them, so what is on screen is what is
 * written.
 */
export interface PrimitiveExample {
  /** What it shows, in a sentence or two: Markdown. */
  description: string;
  /** Its name in the preview's `example` prop. */
  id: string;
  /** The props it gives the root, over the usage's own. */
  props: Readonly<Record<string, boolean | number | string>>;
  title: string;
}

export const EXAMPLES: Record<string, readonly PrimitiveExample[]> = {
  knob: [
    {
      description:
        '`dragMode="vertical"` maps a vertical drag to the value, as a fader does: up raises it, down lowers it, and the pointer\'s path around the dial no longer matters.',
      id: "vertical",
      props: { dragMode: "vertical" },
      title: "Vertical drag",
    },
    {
      description:
        '`scale="log"` spreads the travel by ratio, so each turn covers the same number of octaves: the way a frequency knob wants to be turned. It needs a positive `min`.',
      id: "log",
      props: { defaultValue: 1000, max: 20_000, min: 20, scale: "log" },
      title: "Logarithmic scale",
    },
  ],
};

/** The example of a page by its id. */
export const exampleOf = (page: string, id: string | undefined) =>
  EXAMPLES[page]?.find((each) => each.id === id);
