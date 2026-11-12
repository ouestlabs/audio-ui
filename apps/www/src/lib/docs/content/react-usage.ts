import { SKINS } from "@/lib/docs/content/element-skins";
import type { StylingId } from "@/lib/docs/content/stylings";

/**
 * The React primitives' examples, in the two ways of styling them. Their
 * parts are the elements' parts, so they wear the elements' skins: the same
 * Tailwind classes, and the same stylesheet written for CSS Modules, a class
 * for each part in place of its tag.
 */
export interface ReactUsage {
  /** Other primitives the JSX uses, imported with it. */
  also?: readonly string[];
  /** The primitive's entry, `@audio-ui/react/<entry>`, and its skin. */
  entry: string;
  /** The JSX, one tag a line, two spaces a level. */
  lines: readonly string[];
  /** The primitive's name, as it is imported. */
  name: string;
}

export const REACT_USAGES: Record<string, ReactUsage> = {
  envelope: {
    entry: "envelope",
    lines: [
      '<Envelope.Root aria-label="Amp envelope" defaultValue={points}>',
      "  <Envelope.Graph>",
      "    <Envelope.Fill />",
      "    <Envelope.Line />",
      "  </Envelope.Graph>",
      "  <Envelope.Segments>",
      "    {(_, index) => <Envelope.Segment index={index} />}",
      "  </Envelope.Segments>",
      "  <Envelope.Points>",
      "    {(_, index) => <Envelope.Point index={index} />}",
      "  </Envelope.Points>",
      "</Envelope.Root>",
    ],
    name: "Envelope",
  },
  fader: {
    entry: "fader",
    lines: [
      "<Fader.Root defaultValue={-6}>",
      "  <Fader.Control>",
      "    <Fader.Track>",
      "      <Fader.Indicator />",
      "    </Fader.Track>",
      '    <Fader.Thumb aria-label="Volume" />',
      "  </Fader.Control>",
      "</Fader.Root>",
    ],
    name: "Fader",
  },
  knob: {
    entry: "knob",
    lines: [
      "<Knob.Root min={0} max={100} defaultValue={40}>",
      "  <Knob.Label>Volume</Knob.Label>",
      "  <Knob.Control>",
      "    <Knob.Track />",
      "    <Knob.Indicator />",
      "    <Knob.Thumb />",
      "  </Knob.Control>",
      "  <Knob.Value />",
      "</Knob.Root>",
    ],
    name: "Knob",
  },
  meter: {
    entry: "meter",
    lines: [
      "<Meter.Root min={-60} max={6} value={[-18, -10]}>",
      "  <Meter.Channels>",
      "    {(index) => (",
      '      <Meter.Channel index={index} aria-label={index === 0 ? "Left" : "Right"}>',
      "        <Meter.Indicator />",
      "        <Meter.Peak />",
      "      </Meter.Channel>",
      "    )}",
      "  </Meter.Channels>",
      "</Meter.Root>",
    ],
    name: "Meter",
  },
  pad: {
    entry: "pad",
    lines: [
      '<Pad.Root aria-label="Drums">',
      '  <Pad.Item value="kick">Kick</Pad.Item>',
      '  <Pad.Item value="snare">Snare</Pad.Item>',
      '  <Pad.Item value="hat">Hat</Pad.Item>',
      '  <Pad.Item value="clap">Clap</Pad.Item>',
      "</Pad.Root>",
    ],
    name: "Pad",
  },
  piano: {
    entry: "piano",
    lines: [
      '<Piano.Root aria-label="Keys" minPitch={48} maxPitch={71}>',
      "  <Piano.Keys>",
      "    {(pitch) => <Piano.Key pitch={pitch} />}",
      "  </Piano.Keys>",
      "</Piano.Root>",
    ],
    name: "Piano",
  },
  "piano-roll": {
    also: ["Timeline"],
    entry: "piano-roll",
    lines: [
      "<Timeline.Root duration={8} snapStep={0.5}>",
      '  <PianoRoll.Root minPitch={57} maxPitch={74} defaultValue={notes} mode="draw">',
      "    <PianoRoll.Keys>",
      "      <PianoRoll.Rows>",
      "        {(pitch) => <PianoRoll.Key pitch={pitch} />}",
      "      </PianoRoll.Rows>",
      "    </PianoRoll.Keys>",
      "    <Timeline.Viewport>",
      '      <PianoRoll.Grid aria-label="Notes">',
      "        <PianoRoll.Rows>",
      "          {(pitch) => <PianoRoll.Row pitch={pitch} />}",
      "        </PianoRoll.Rows>",
      "        <PianoRoll.Notes>",
      "          {(note) => <PianoRoll.Note key={note.id} note={note} />}",
      "        </PianoRoll.Notes>",
      "        <PianoRoll.Marquee />",
      "        <Timeline.Playhead />",
      "      </PianoRoll.Grid>",
      "    </Timeline.Viewport>",
      '    <PianoRoll.VelocityLane aria-label="Velocity">',
      "      <PianoRoll.Notes>",
      "        {(note) => <PianoRoll.Velocity key={note.id} note={note} />}",
      "      </PianoRoll.Notes>",
      "    </PianoRoll.VelocityLane>",
      "  </PianoRoll.Root>",
      "</Timeline.Root>",
    ],
    name: "PianoRoll",
  },
  plot: {
    entry: "plot",
    lines: [
      '<Plot.Root minX={20} maxX={20000} minY={-18} maxY={18} scaleX="log">',
      "  <Plot.Grid x={{}} y={{}} />",
      "  <Plot.Graph>",
      "    <Plot.Curve fn={(hz) => bell(hz, band)} fillTo={0} />",
      "  </Plot.Graph>",
      '  <Plot.Handle aria-label="Band" value={band} onValueChange={setBand} />',
      "</Plot.Root>",
    ],
    name: "Plot",
  },
  sequencer: {
    entry: "sequencer",
    lines: [
      '<Sequencer.Root aria-label="Pattern" defaultValue={pattern}>',
      "  <Sequencer.Rows>",
      "    {(row) => (",
      "      <Sequencer.Row index={row}>",
      "        <Sequencer.Cells>",
      "          {(step) => <Sequencer.Cell step={step} />}",
      "        </Sequencer.Cells>",
      "      </Sequencer.Row>",
      "    )}",
      "  </Sequencer.Rows>",
      "</Sequencer.Root>",
    ],
    name: "Sequencer",
  },
  timeline: {
    entry: "timeline",
    lines: [
      "<Timeline.Root duration={32} snapStep={1}>",
      "  <Timeline.Viewport>",
      '    <Timeline.Ruler aria-label="Position">',
      "      <Timeline.Mark value={0}>1</Timeline.Mark>",
      "      <Timeline.Mark value={8}>3</Timeline.Mark>",
      '      <Timeline.Range aria-label="Loop" defaultValue={[8, 16]} />',
      "    </Timeline.Ruler>",
      "    <Timeline.Track>",
      "      <Timeline.TrackHeader>Drums</Timeline.TrackHeader>",
      "      <Timeline.Lane>",
      '        <Timeline.Clip aria-label="Beat" defaultValue={beat}>',
      "          <Timeline.ClipHeader>Beat</Timeline.ClipHeader>",
      '          <Timeline.ClipHandle edge="start" aria-label="Trim start" />',
      '          <Timeline.ClipHandle edge="end" aria-label="Trim end" />',
      "        </Timeline.Clip>",
      "        <Timeline.Playhead />",
      "      </Timeline.Lane>",
      "    </Timeline.Track>",
      "  </Timeline.Viewport>",
      "  <Timeline.Navigator>",
      '    <Timeline.NavigatorWindow aria-label="View" />',
      "  </Timeline.Navigator>",
      "</Timeline.Root>",
    ],
    name: "Timeline",
  },
  waveform: {
    entry: "waveform",
    lines: [
      "<Waveform.Root duration={96} peaks={peaks} defaultValue={30}>",
      '  <Waveform.Control aria-label="Seek">',
      "    <Waveform.Canvas />",
      "    <Waveform.Region defaultValue={[54, 72]}>",
      '      <Waveform.RegionHandle edge="start" aria-label="Loop start" />',
      '      <Waveform.RegionHandle edge="end" aria-label="Loop end" />',
      "    </Waveform.Region>",
      "    <Waveform.Playhead />",
      "  </Waveform.Control>",
      "</Waveform.Root>",
    ],
    name: "Waveform",
  },
  xypad: {
    entry: "xypad",
    lines: [
      "<XYPad.Root defaultValue={{ x: 30, y: 70 }}>",
      "  <XYPad.Control>",
      '    <XYPad.Thumb aria-label="Filter" />',
      "  </XYPad.Control>",
      "  <XYPad.Value />",
      "</XYPad.Root>",
    ],
    name: "XYPad",
  },
};

/** What a snippet needs that the JSX leaves out, by page: a pattern to start from. */
const SETUP: Record<string, readonly string[]> = {
  "piano-roll": [
    "const notes = [",
    '  { id: "a", pitch: 60, start: 0, length: 1, velocity: 0.9 },',
    '  { id: "b", pitch: 64, start: 1, length: 1, velocity: 0.6 },',
    '  { id: "c", pitch: 67, start: 2, length: 1, velocity: 0.75 },',
    "];",
  ],
  timeline: [
    "const beat = { start: 0, length: 8, offset: 0, fadeIn: 0, fadeOut: 0 };",
  ],
  envelope: [
    "const points = [",
    "  { x: 0, y: 0 },",
    "  { x: 0.12, y: 1 },",
    "  { x: 0.35, y: 0.6, curve: 0.4 },",
    "  { x: 0.75, y: 0.6 },",
    "  { x: 1, y: 0 },",
    "];",
  ],
  plot: [
    "// A peaking band's response in dB at each frequency, around its center.",
    "const bell = (hz: number, { x, y }: { x: number; y: number }) =>",
    "  y * Math.exp(-(Math.log2(hz / x) ** 2) * 1.6);",
    "",
    "// In the component: the curve follows the handle.",
    "const [band, setBand] = useState({ x: 800, y: 6 });",
  ],
  waveform: [
    "// Min and max pairs across the sound, from computePeaks in @audio-ui/engine/analysis.",
    "const peaks: number[] = [];",
  ],
  sequencer: [
    "const pattern = [",
    "  [true, false, false, false, true, false, false, false],",
    "  [false, false, true, false, false, false, true, false],",
    "];",
  ],
};

const PART = /<([A-Z][A-Za-z]*)\.([A-Z][A-Za-z]*)/;
const DOT = ".";
const CONSONANT_Y = /[^aeiou]y$/;
const UPPER = /([a-z])([A-Z])/g;
const TAG = /audio-ui-[a-z-]+/g;
/** A piano root inside a roll's keys: React's roll has the keys themselves. */
const NESTED_PIANO = /audio-ui-piano-roll-keys audio-ui-piano \{[^}]*\}\n\n/;

const kebab = (name: string) => name.replace(UPPER, "$1-$2").toLowerCase();
/** A part's name in the plural, as the holder of the parts the elements generate is named: Velocity is Velocities. */
const plural = (name: string) =>
  CONSONANT_Y.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`;
const camel = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/** The element tag a part is styled as in the skins: `Knob.Thumb` is `audio-ui-knob-thumb`. */
/**
 * Where a page's skin names a part differently than its React part: the parts
 * of another primitive it uses (a piano roll sits in a timeline), and a part
 * the elements generate under another's name (a piano roll's keys are the
 * piano's).
 */
const TAGS: Record<string, Record<string, string>> = {
  "piano-roll": {
    Key: "audio-ui-piano-keys",
    "Timeline.Playhead": "audio-ui-timeline-playhead",
    "Timeline.Root": "audio-ui-timeline",
    "Timeline.Viewport": "audio-ui-timeline-viewport",
  },
};

/** The tags of a skin's sheet that stand for a React part's class: `audio-ui-piano-key` is the roll's `key`. */
const CLASS_OF_TAG: Record<string, Record<string, string>> = {
  "piano-roll": {
    "audio-ui-piano-key": "key",
    "audio-ui-timeline": "timelineRoot",
    "audio-ui-timeline-playhead": "timelinePlayhead",
    "audio-ui-timeline-viewport": "timelineViewport",
  },
};

function tagOf(entry: string, part: string) {
  const named = TAGS[entry]?.[part];
  if (named) {
    return named;
  }
  return part === "Root"
    ? `audio-ui-${entry}`
    : `audio-ui-${entry}-${kebab(part)}`;
}

/** The class a part takes in a CSS Modules sheet: its name, the root being `root`. */
export const moduleClass = (part: string, prefix = "") =>
  `${prefix}${camel(part.replace(DOT, ""))}`;

/**
 * What the elements do for themselves and the headless parts leave to you: a
 * box to position its parts in, an SVG that fills it, a color for a shape's
 * fill or stroke. Added to the skin, by the part's class.
 */
const STRUCTURE: Record<string, Record<string, { css: string; tw: string }>> = {
  envelope: {
    fill: { css: "fill: currentColor;", tw: "fill-current" },
    graph: {
      css: "display: block;\n  width: 100%;\n  height: 100%;\n  overflow: visible;",
      tw: "block size-full overflow-visible",
    },
    line: {
      css: "fill: none;\n  stroke: currentColor;\n  stroke-linejoin: round;",
      tw: "fill-none stroke-current [stroke-linejoin:round]",
    },
    root: { css: "position: relative;", tw: "relative" },
  },
  plot: {
    curve: {
      css: "fill: currentColor;\n  stroke: none;",
      tw: "fill-current stroke-none",
    },
    root: { css: "position: relative;", tw: "relative" },
  },
  timeline: {
    lane: {
      css: "position: relative;\n  flex: 1 1 0;\n  min-width: 0;",
      tw: "relative min-w-0 flex-1",
    },
    navigator: { css: "position: relative;", tw: "relative" },
    ruler: { css: "position: relative;", tw: "relative" },
    track: { css: "display: flex;", tw: "flex" },
  },
  waveform: {
    canvas: {
      css: "display: block;\n  width: 100%;\n  height: 100%;",
      tw: "block size-full",
    },
  },
};

const CHILD = /^\*:/;

/**
 * The skin's Tailwind classes for a part of a primitive, if it has some. A
 * part the elements generate, styled with `*:` from the part that holds it
 * (a piano's keys), takes those classes itself in React.
 */
export function tailwindClasses(entry: string, part: string) {
  return forReact(tailwindOf(entry, part));
}

/** What the elements read from an attribute, the React parts carry as a data attribute. */
const forReact = <T extends string | undefined>(value: T): T =>
  value?.replaceAll("[edge=", "[data-edge=") as T;

function tailwindOf(entry: string, part: string) {
  const extra = STRUCTURE[entry]?.[moduleClass(part)]?.tw;
  const own = TAGS[entry]?.[part]?.endsWith("s")
    ? undefined
    : SKINS[entry]?.tailwind[tagOf(entry, part)];
  if (own) {
    return extra ? `${own} ${extra}` : own;
  }
  const holder =
    SKINS[entry]?.tailwind[TAGS[entry]?.[part] ?? tagOf(entry, plural(part))];
  const child = holder
    ?.split(" ")
    .filter((name) => CHILD.test(name))
    .map((name) => name.replace(CHILD, ""))
    .join(" ");
  return [child, extra].filter(Boolean).join(" ") || undefined;
}

/** The skin's sheet with the structure the headless parts need: into the part's own rule, or a rule of its own. */
function withStructure(entry: string, css: string): string {
  let result = css;
  for (const [part, { css: rules }] of Object.entries(STRUCTURE[entry] ?? {})) {
    const tag =
      part === "root"
        ? `audio-ui-${entry}`
        : `audio-ui-${entry}-${kebab(part)}`;
    const rule = new RegExp(`(^${tag} \\{[^}]*?)\\n\\}`, "m");
    result = rule.test(result)
      ? result.replace(rule, `$1\n  ${rules}\n}`)
      : `${result}\n\n${tag} {\n  ${rules}\n}`;
  }
  return result;
}

/** The skin's stylesheet as CSS Modules write it: a class for each part in place of its tag. */
export function moduleCss(entry: string, prefix = ""): string {
  const css = forReact(
    withStructure(entry, SKINS[entry]?.css ?? "").replace(NESTED_PIANO, "")
  );
  return css.replace(TAG, (tag) => {
    const alias = CLASS_OF_TAG[entry]?.[tag];
    if (alias) {
      return `.${prefix}${alias}`;
    }
    if (tag === `audio-ui-${entry}`) {
      return `.${prefix}root`;
    }
    const rest = tag.slice(`audio-ui-${entry}-`.length);
    return `.${prefix}${rest.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`;
  });
}

/** The classes the sheet styles, as the JSX names them. */
function styled(css: string): Set<string> {
  return new Set([...css.matchAll(/\.([a-zA-Z]+)/g)].map((m) => m[1] ?? ""));
}

/** The JSX of a page with the classes of a styling on its parts. */
export function reactJsx(page: string, styling: StylingId): string[] {
  const usage = REACT_USAGES[page];
  if (!usage) {
    return [];
  }
  const sheet = styled(moduleCss(usage.entry));
  return usage.lines.map((line) => {
    const match = line.match(PART);
    const primitive = match?.[1] ?? "";
    const foreign = primitive !== usage.name;
    if (
      !match ||
      (foreign && !TAGS[usage.entry]?.[`${primitive}.${match[2]}`])
    ) {
      return line;
    }
    const part = foreign ? `${primitive}.${match[2]}` : (match[2] ?? "");
    const at = (match.index ?? 0) + match[0].length;
    if (styling === "tailwind") {
      const classes = tailwindClasses(usage.entry, part);
      return classes
        ? `${line.slice(0, at)} className="${classes}"${line.slice(at)}`
        : line;
    }
    const name = part === "Root" ? "root" : moduleClass(part);
    return sheet.has(name)
      ? `${line.slice(0, at)} className={styles.${name}}${line.slice(at)}`
      : line;
  });
}

/** The code blocks of a page in a styling: its component, and for CSS its module. */
export function reactSnippets(page: string, styling: StylingId) {
  const usage = REACT_USAGES[page];
  if (!usage) {
    return null;
  }
  const setup = SETUP[page] ?? [];
  const tsx = [
    `import { ${[usage.name, ...(usage.also ?? [])].join(", ")} } from "@audio-ui/react";`,
    ...(styling === "css"
      ? [`import styles from "./${page}.module.css";`]
      : []),
    ...(setup.length > 0 ? ["", ...setup] : []),
    "",
    ...reactJsx(page, styling),
  ].join("\n");
  return {
    css: styling === "css" ? moduleCss(usage.entry) : null,
    tsx,
  };
}
