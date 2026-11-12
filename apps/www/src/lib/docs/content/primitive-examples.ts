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

const ex = (
  id: string,
  title: string,
  description: string,
  props: PrimitiveExample["props"]
): PrimitiveExample => ({ description, id, props, title });

export const EXAMPLES: Record<string, readonly PrimitiveExample[]> = {
  envelope: [
    ex(
      "limited",
      "Limited points",
      "`maxPoints` caps how many points the envelope holds: a double click on the graph is refused at the limit, and the graph says so with `data-blocked`.",
      { maxPoints: 5 }
    ),
    ex(
      "coarse",
      "Coarse steps",
      "`step` rounds every point to a multiple of it, along both axes: a dragged point lands on a grid of tenths.",
      { step: 0.1 }
    ),
  ],
  fader: [
    ex(
      "range",
      "Custom range",
      "`min` and `max` set the travel: here a trim of plus or minus 12 dB, resting at 0.",
      { defaultValue: 0, max: 12, min: -12 }
    ),
    ex(
      "anchor",
      "Anchored indicator",
      "`anchor` is the value the indicator grows from: on a trim, it fills away from 0 in either direction rather than from the bottom.",
      { anchor: 0, defaultValue: 4, max: 12, min: -12 }
    ),
  ],
  knob: [
    ex(
      "vertical",
      "Vertical drag",
      '`dragMode="vertical"` maps a vertical drag to the value, as a fader does: up raises it, down lowers it, and the pointer\'s path around the dial no longer matters.',
      { dragMode: "vertical" }
    ),
    ex(
      "log",
      "Logarithmic scale",
      '`scale="log"` spreads the travel by ratio, so each turn covers the same number of octaves: the way a frequency knob wants to be turned. It needs a positive `min`.',
      { defaultValue: 1000, max: 20_000, min: 20, scale: "log" }
    ),
  ],
  meter: [
    ex(
      "range",
      "Narrow range",
      "`min` and `max` set the levels the bar spans: here the top 24 dB, where a mix meter spends its time.",
      { max: 0, min: -24 }
    ),
  ],
  pad: [
    ex(
      "disabled",
      "Disabled",
      "`disabled` stops every pad from sounding and from taking the focus, and sets `data-disabled` on them for the look.",
      { disabled: true }
    ),
  ],
  piano: [
    ex(
      "octave",
      "One octave",
      "`minPitch` and `maxPitch` are MIDI pitches, both inclusive: 60 to 71 is the octave from middle C.",
      { maxPitch: 71, minPitch: 60 }
    ),
    ex(
      "wide",
      "Five octaves",
      "The keys shrink to fit the width: 36 to 96 is five octaves, with their black keys in place.",
      { maxPitch: 96, minPitch: 36 }
    ),
  ],
  "piano-roll": [
    ex(
      "longer",
      "A longer clip",
      "The roll takes its length from the timeline around it: `duration` is in beats here, and the notes keep their place on a grid twice as wide.",
      { duration: 16 }
    ),
    ex(
      "fine",
      "A finer grid",
      "`snapStep` is the distance between grid lines, and what a note snaps to: sixteenth notes, a quarter of a beat.",
      { snapStep: 0.25 }
    ),
  ],
  plot: [
    ex(
      "linear",
      "Linear axis",
      "`scaleX` spreads the x axis: `log` for frequency, as in the usage, or `linear` for values that grow by addition.",
      { scaleX: "linear" }
    ),
    ex(
      "narrow",
      "Narrow gain range",
      "`minY` and `maxY` set the y axis: here plus or minus 6 dB, so the same curve fills more of the plot.",
      { maxY: 6, minY: -6 }
    ),
  ],
  sequencer: [
    ex(
      "disabled",
      "Disabled",
      "`disabled` freezes the pattern: no cell toggles, and `data-disabled` is set on the root.",
      { disabled: true }
    ),
  ],
  timeline: [
    ex(
      "longer",
      "A longer timeline",
      "`duration` is in your units: 64 gives the arrangement twice the room, and the clips keep their length.",
      { duration: 64 }
    ),
    ex(
      "coarse",
      "A coarser grid",
      "`snapStep` is the distance between grid lines, and what a dragged clip snaps to: four units, a bar.",
      { snapStep: 4 }
    ),
  ],
  waveform: [
    ex(
      "long",
      "A longer sound",
      "`duration` is the sound's length in the unit `value` is in: the position and the region scale with it.",
      { defaultValue: 90, duration: 240 }
    ),
  ],
  xypad: [
    ex(
      "coarse",
      "Coarse steps",
      "`stepX` and `stepY` round each axis to a multiple of them: the point jumps from tens to tens.",
      { stepX: 10, stepY: 10 }
    ),
    ex(
      "disabled",
      "Disabled",
      "`disabled` freezes the point and takes it out of the tab order.",
      { disabled: true }
    ),
  ],
};

/** The example of a page by its id. */
export const exampleOf = (page: string, id: string | undefined) =>
  EXAMPLES[page]?.find((each) => each.id === id);
