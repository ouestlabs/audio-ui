import { SKINS } from "@/lib/docs/content/element-skins";
import type { StylingId } from "@/lib/docs/content/stylings";

/**
 * The React primitives' examples, in the two ways of styling them. Their
 * parts are the elements' parts, so they wear the elements' skins: the same
 * Tailwind classes, and the same stylesheet written for CSS Modules, a class
 * for each part in place of its tag.
 */
export interface ReactUsage {
  /** The primitive's entry, `@audio-ui/react/<entry>`, and its skin. */
  entry: string;
  /** The JSX, one tag a line, two spaces a level. */
  lines: readonly string[];
  /** The primitive's name, as it is imported. */
  name: string;
}

export const REACT_USAGES: Record<string, ReactUsage> = {
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
  sequencer: [
    "const pattern = [",
    "  [true, false, false, false, true, false, false, false],",
    "  [false, false, true, false, false, false, true, false],",
    "];",
  ],
};

const PART = /<([A-Z][A-Za-z]*)\.([A-Z][A-Za-z]*)/;
const UPPER = /([a-z])([A-Z])/g;
const TAG = /audio-ui-[a-z-]+/g;

const kebab = (name: string) => name.replace(UPPER, "$1-$2").toLowerCase();
const camel = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/** The element tag a part is styled as in the skins: `Knob.Thumb` is `audio-ui-knob-thumb`. */
function tagOf(entry: string, part: string) {
  return part === "Root"
    ? `audio-ui-${entry}`
    : `audio-ui-${entry}-${kebab(part)}`;
}

/** The class a part takes in a CSS Modules sheet: its name, the root being `root`. */
export const moduleClass = (part: string, prefix = "") =>
  `${prefix}${camel(part)}`;

const CHILD = /^\*:/;

/**
 * The skin's Tailwind classes for a part of a primitive, if it has some. A
 * part the elements generate, styled with `*:` from the part that holds it
 * (a piano's keys), takes those classes itself in React.
 */
export function tailwindClasses(entry: string, part: string) {
  const own = SKINS[entry]?.tailwind[tagOf(entry, part)];
  if (own) {
    return own;
  }
  const holder = SKINS[entry]?.tailwind[tagOf(entry, `${part}s`)];
  return holder
    ?.split(" ")
    .filter((name) => CHILD.test(name))
    .map((name) => name.replace(CHILD, ""))
    .join(" ");
}

/** The skin's stylesheet as CSS Modules write it: a class for each part in place of its tag. */
export function moduleCss(entry: string, prefix = ""): string {
  const css = SKINS[entry]?.css ?? "";
  return css.replace(TAG, (tag) => {
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
    if (!(match && match[1] === usage.name)) {
      return line;
    }
    const part = match[2] ?? "";
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
    `import { ${usage.name} } from "@audio-ui/react";`,
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
