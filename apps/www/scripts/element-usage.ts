/**
 * Writes the usage of each custom element in every framework into its page:
 * one set of framework tabs under the live preview, between two markers,
 * built from the table below, so the HTML, the Vue and the Svelte of an
 * element always say the same thing. React points to the primitive.
 *
 *   bun scripts/element-usage.ts          check: lists the pages that differ, exits 1
 *   bun scripts/element-usage.ts --write  writes them
 */

const PAGES = `${import.meta.dir}/../src/content/docs/elements`;
const START =
  "{/* usage:start: written by `bun scripts/element-usage.ts --write` */}";
const END = "{/* usage:end */}";
/** Where a binding goes in a tag of the markup. */
const BIND = "%bind%";
/** Where a part takes its properties. */
const PROPS = "%props%";
/** What ends a tag's name: a space, the bracket or the binding's mark. */
const TAG_END = /[\s>%]/;
const KEBAB = /-([a-z])/g;
const EMPTY_TAG = /<(audio-ui-[a-z-]+)([^>]*)><\/\1>/g;

/**
 * How the snippets follow an element: a value bound both ways (`model`, what
 * takes `v-model`), a value only shown (`display`), or an event heard.
 */
type Follow =
  | {
      initial: string;
      kind: "model";
      name: string;
      /** The value as the attribute writes it, in plain HTML. */
      web: string;
    }
  | {
      initial: string;
      kind: "display";
      name: string;
      /** A later value, as a script sets it. */
      update: string;
      web: string;
    }
  | { event: string; kind: "event"; read: string };

/** A JavaScript value a part takes as a property, which no attribute carries: a function or an array. */
interface Property {
  /** What it holds, as the comment over its declaration says. */
  about: string;
  /** Its first value, as the scripts declare it. */
  initial: string;
  /** The part's property. */
  property: string;
  /** The part, whose line in the markup holds `%props%`. */
  tag: string;
  /** Its TypeScript type, for the Vue and Svelte scripts. */
  type: string;
  /** The name the scripts give it. */
  value: string;
}

interface Usage {
  /** The element's entry point, and its page. */
  entry: string;
  follow: Follow;
  /** The markup inside the root, one line a tag, two spaces a level; `%bind%` where the followed part takes its binding. */
  inner: readonly string[];
  /** The values its parts take as properties. */
  properties?: readonly Property[];
  /** The React primitive's name, as its page is titled. */
  react: string;
  /** The root tag and its attributes; `%bind%` where it takes the binding. */
  root: string;
  /** The tag the script listens on or binds, when it is not the root's. */
  target?: string;
}

const knobParts = (label: string) => [
  `<audio-ui-knob-label>${label}</audio-ui-knob-label>`,
  "<audio-ui-knob-control>",
  "  <audio-ui-knob-track></audio-ui-knob-track>",
  "  <audio-ui-knob-indicator></audio-ui-knob-indicator>",
  "  <audio-ui-knob-thumb></audio-ui-knob-thumb>",
  "</audio-ui-knob-control>",
  "<audio-ui-knob-value></audio-ui-knob-value>",
];

const meterChannel = (index: number, label: string) => [
  `<audio-ui-meter-channel index="${index}" aria-label="${label}">`,
  "  <audio-ui-meter-indicator></audio-ui-meter-indicator>",
  "  <audio-ui-meter-peak></audio-ui-meter-peak>",
  "</audio-ui-meter-channel>",
];

const sequencerRow = (index: number, label: string) => [
  `<audio-ui-sequencer-row index="${index}" aria-label="${label}">`,
  ...[0, 1, 2, 3].map(
    (step) =>
      `  <audio-ui-sequencer-cell step="${step}"></audio-ui-sequencer-cell>`
  ),
  "</audio-ui-sequencer-row>",
];

export const USAGES: Record<string, Usage> = {
  envelope: {
    entry: "envelope",
    follow: { event: "change", kind: "event", read: "event.detail.value" },
    inner: [
      "<audio-ui-envelope-graph>",
      "  <audio-ui-envelope-fill></audio-ui-envelope-fill>",
      "  <audio-ui-envelope-line></audio-ui-envelope-line>",
      "</audio-ui-envelope-graph>",
      "<audio-ui-envelope-segments></audio-ui-envelope-segments>",
      "<audio-ui-envelope-points></audio-ui-envelope-points>",
    ],
    react: "Envelope",
    root: '<audio-ui-envelope aria-label="Amp envelope" default-value="0 0, 0.12 1, 0.35 0.6 0.4, 0.75 0.6, 1 0"%bind%>',
  },
  fader: {
    entry: "fader",
    follow: { initial: "-6", kind: "model", name: "level", web: "-6" },
    inner: [
      "<audio-ui-fader-control>",
      "  <audio-ui-fader-track>",
      "    <audio-ui-fader-indicator></audio-ui-fader-indicator>",
      "  </audio-ui-fader-track>",
      '  <audio-ui-fader-thumb aria-label="Volume"></audio-ui-fader-thumb>',
      "</audio-ui-fader-control>",
    ],
    react: "Fader",
    root: "<audio-ui-fader%bind%>",
  },
  knob: {
    entry: "knob",
    follow: { initial: "40", kind: "model", name: "volume", web: "40" },
    inner: knobParts("Volume"),
    react: "Knob",
    root: '<audio-ui-knob min="0" max="100"%bind%>',
  },
  meter: {
    entry: "meter",
    follow: {
      initial: '"-18 -10"',
      kind: "display",
      name: "levels",
      update: "-12 -6",
      web: "-18 -10",
    },
    inner: [...meterChannel(0, "Left"), ...meterChannel(1, "Right")],
    react: "Meter",
    root: '<audio-ui-meter min="-60" max="6"%bind%>',
  },
  pad: {
    entry: "pad",
    follow: { event: "padon", kind: "event", read: "event.detail.value" },
    inner: ["Kick", "Snare", "Hat", "Clap"].map(
      (label) =>
        `<audio-ui-pad-item value="${label.toLowerCase()}">${label}</audio-ui-pad-item>`
    ),
    react: "Pad",
    root: '<audio-ui-pad aria-label="Drums"%bind%>',
  },
  piano: {
    entry: "piano",
    follow: { event: "noteon", kind: "event", read: "event.detail.pitch" },
    inner: ["<audio-ui-piano-keys></audio-ui-piano-keys>"],
    react: "Piano",
    root: '<audio-ui-piano aria-label="Keys" min-pitch="48" max-pitch="71"%bind%>',
  },
  "piano-roll": {
    entry: "piano-roll",
    follow: { event: "change", kind: "event", read: "event.detail.value" },
    inner: [
      '<audio-ui-piano-roll min-pitch="57" max-pitch="74"%bind%>',
      "  <audio-ui-piano-roll-keys>",
      '    <audio-ui-piano aria-label="Keys">',
      "      <audio-ui-piano-keys></audio-ui-piano-keys>",
      "    </audio-ui-piano>",
      "  </audio-ui-piano-roll-keys>",
      "  <audio-ui-timeline-viewport>",
      '    <audio-ui-piano-roll-grid aria-label="Notes">',
      "      <audio-ui-piano-roll-rows></audio-ui-piano-roll-rows>",
      "      <audio-ui-piano-roll-notes></audio-ui-piano-roll-notes>",
      "      <audio-ui-timeline-playhead></audio-ui-timeline-playhead>",
      "    </audio-ui-piano-roll-grid>",
      "  </audio-ui-timeline-viewport>",
      "</audio-ui-piano-roll>",
    ],
    react: "PianoRoll",
    root: '<audio-ui-timeline duration="8" snap-step="0.5">',
    target: "audio-ui-piano-roll",
  },
  plot: {
    entry: "plot",
    follow: {
      initial: "{ x: 800, y: 6 }",
      kind: "model",
      name: "band",
      web: "800 6",
    },
    inner: [
      "<audio-ui-plot-grid></audio-ui-plot-grid>",
      '<audio-ui-plot-curve fill-to="0"%props%></audio-ui-plot-curve>',
      '<audio-ui-plot-handle aria-label="Band"%bind%></audio-ui-plot-handle>',
    ],
    properties: [
      {
        about:
          "The curve: its level in dB at each frequency, such as a filter's response.",
        initial: "(hz) => 0",
        property: "fn",
        tag: "audio-ui-plot-curve",
        type: "(hz: number) => number",
        value: "response",
      },
    ],
    react: "Plot",
    root: '<audio-ui-plot min-x="20" max-x="20000" min-y="-18" max-y="18" scale-x="log">',
    target: "audio-ui-plot-handle",
  },
  sequencer: {
    entry: "sequencer",
    follow: { event: "change", kind: "event", read: "event.detail.value" },
    inner: [...sequencerRow(0, "Kick"), ...sequencerRow(1, "Snare")],
    react: "Sequencer",
    root: '<audio-ui-sequencer aria-label="Pattern" default-value="x.x. ..x."%bind%>',
  },
  timeline: {
    entry: "timeline",
    follow: { event: "change", kind: "event", read: "event.detail.value" },
    inner: [
      "<audio-ui-timeline-viewport>",
      '  <audio-ui-timeline-ruler aria-label="Position"></audio-ui-timeline-ruler>',
      "  <audio-ui-timeline-track>",
      "    <audio-ui-timeline-track-header>Drums</audio-ui-timeline-track-header>",
      "    <audio-ui-timeline-lane seekable>",
      '      <audio-ui-timeline-clip aria-label="Beat" start="0" length="8">',
      "        <audio-ui-timeline-clip-header>Beat</audio-ui-timeline-clip-header>",
      "      </audio-ui-timeline-clip>",
      "      <audio-ui-timeline-playhead></audio-ui-timeline-playhead>",
      "    </audio-ui-timeline-lane>",
      "  </audio-ui-timeline-track>",
      "</audio-ui-timeline-viewport>",
    ],
    react: "Timeline",
    root: '<audio-ui-timeline duration="32" snap-step="1"%bind%>',
  },
  waveform: {
    entry: "waveform",
    follow: { initial: "30", kind: "model", name: "position", web: "30" },
    inner: [
      '<audio-ui-waveform-control aria-label="Seek">',
      "  <audio-ui-waveform-canvas></audio-ui-waveform-canvas>",
      "  <audio-ui-waveform-playhead></audio-ui-waveform-playhead>",
      "</audio-ui-waveform-control>",
    ],
    react: "Waveform",
    properties: [
      {
        about:
          "Min and max pairs across the sound, from computePeaks in @audio-ui/engine/analysis.",
        initial: "[]",
        property: "peaks",
        tag: "audio-ui-waveform",
        type: "number[]",
        value: "peaks",
      },
    ],
    root: '<audio-ui-waveform duration="96"%props%%bind%>',
  },
  xypad: {
    entry: "xypad",
    follow: {
      initial: "{ x: 30, y: 70 }",
      kind: "model",
      name: "point",
      web: "30 70",
    },
    inner: [
      "<audio-ui-xypad-control>",
      '  <audio-ui-xypad-thumb aria-label="Filter"></audio-ui-xypad-thumb>',
      "</audio-ui-xypad-control>",
      "<audio-ui-xypad-value></audio-ui-xypad-value>",
    ],
    react: "XYPad",
    root: "<audio-ui-xypad%bind%>",
  },
};

type Flavor = "svelte" | "vue" | "web";

/** What a tag takes to follow the element, in a flavor of markup. */
function binding(follow: Follow, flavor: Flavor): string {
  if (follow.kind === "event") {
    if (flavor === "vue") {
      return ` @${follow.event}="(event) => console.log(${follow.read})"`;
    }
    return flavor === "svelte"
      ? ` on${follow.event}={(event) => console.log(${follow.read})}`
      : "";
  }
  if (flavor === "web") {
    return ` value="${follow.web}"`;
  }
  if (flavor === "vue") {
    return follow.kind === "model"
      ? ` v-model="${follow.name}"`
      : ` :value="${follow.name}"`;
  }
  return follow.kind === "model"
    ? ` value={${follow.name}} oninput={(event) => (${follow.name} = event.detail.value)}`
    : ` value={${follow.name}}`;
}

/** What a line's tag takes of the properties, in a flavor of markup: plain HTML sets them from its script. */
function propertyBindings(usage: Usage, line: string, flavor: Flavor) {
  const [tag] = line.trim().slice(1).split(TAG_END);
  return (usage.properties ?? [])
    .filter((each) => each.tag === tag && flavor !== "web")
    .map((each) =>
      flavor === "vue"
        ? ` :${each.property}="${each.value}"`
        : ` ${each.property}={${each.value}}`
    )
    .join("");
}

/** The properties' declarations in a script, each under what it holds; typed in Vue's and Svelte's. */
function declarations(usage: Usage, typed: boolean): string[] {
  return (usage.properties ?? []).flatMap((each) => [
    "",
    `// ${each.about}`,
    typed
      ? `const ${each.value}: ${each.type} = ${each.initial};`
      : `const ${each.value} = ${each.initial};`,
  ]);
}

/** The element's markup in a flavor: the binding on its tag, empty tags closed as the flavor writes them. */
function markup(usage: Usage, flavor: Flavor): string[] {
  const bind = binding(usage.follow, flavor);
  const close = `</${usage.root.slice(1).split(TAG_END)[0]}>`;
  const lines = [
    usage.root,
    ...usage.inner.map((line) => `  ${line}`),
    close,
  ].map((line) =>
    line
      .replace(BIND, line.includes(BIND) ? bind : "")
      .replace(PROPS, propertyBindings(usage, line, flavor))
  );
  return flavor === "vue"
    ? lines.map((line) => line.replace(EMPTY_TAG, "<$1$2 />"))
    : lines;
}

const indent = (lines: readonly string[], spaces: number) =>
  lines.map((line) => (line ? `${" ".repeat(spaces)}${line}` : line));

/** The camel-cased name a script gives the element it holds. */
const variable = (tag: string) =>
  tag
    .replace("audio-ui-", "")
    .replace(KEBAB, (_, letter: string) => letter.toUpperCase());

function webSnippet(usage: Usage): string {
  const tag = usage.target ?? usage.root.slice(1).split(TAG_END)[0] ?? "";
  const name = variable(tag);
  const { follow } = usage;
  const listen =
    follow.kind === "display"
      ? [`${name}.value = "${follow.update}";`]
      : [
          `${name}.addEventListener("${follow.kind === "event" ? follow.event : "input"}", (event) =>`,
          `  console.log(${follow.kind === "event" ? follow.read : "event.detail.value"})`,
          ");",
        ];
  return [
    "```html",
    ...markup(usage, "web"),
    "",
    '<script type="module">',
    `  import "@audio-ui/elements/${usage.entry}";`,
    "",
    `  const ${name} = document.querySelector("${tag}");`,
    ...indent(declarations(usage, false), 2),
    ...indent(
      (usage.properties ?? []).map(
        (each) =>
          `${each.tag === tag ? name : `document.querySelector("${each.tag}")`}.${each.property} = ${each.value};`
      ),
      2
    ),
    ...indent(listen, 2),
    "</script>",
    "```",
  ].join("\n");
}

function vueSnippet(usage: Usage): string {
  const { follow } = usage;
  const state =
    follow.kind === "event"
      ? []
      : [
          'import { ref } from "vue";',
          "",
          `const ${follow.name} = ref(${follow.initial});`,
        ];
  return [
    "```vue",
    '<script setup lang="ts">',
    `import "@audio-ui/elements/${usage.entry}";`,
    ...state,
    ...declarations(usage, true),
    "</script>",
    "",
    "<template>",
    ...indent(markup(usage, "vue"), 2),
    "</template>",
    "```",
  ].join("\n");
}

function svelteSnippet(usage: Usage): string {
  const { follow } = usage;
  const state =
    follow.kind === "event"
      ? []
      : ["", `let ${follow.name} = $state(${follow.initial});`];
  return [
    "```svelte",
    '<script lang="ts">',
    ...indent(
      [
        `import "@audio-ui/elements/${usage.entry}";`,
        ...state,
        ...declarations(usage, true),
      ],
      2
    ),
    "</script>",
    "",
    ...markup(usage, "svelte"),
    "```",
  ].join("\n");
}

/** The block a page holds, markers included. */
export function usageBlock(page: string): string | null {
  const usage = USAGES[page];
  if (!usage) {
    return null;
  }
  return [
    START,
    "",
    '<FrameworkTabs defaultValue="web">',
    "",
    "<TabsList>",
    '  <TabsTrigger value="web"><Icons.javascript /> JavaScript</TabsTrigger>',
    '  <TabsTrigger value="vue"><Icons.vue /> Vue</TabsTrigger>',
    '  <TabsTrigger value="svelte"><Icons.svelte /> Svelte</TabsTrigger>',
    '  <TabsTrigger value="react"><Icons.reactColor /> React</TabsTrigger>',
    "</TabsList>",
    "",
    '<TabsContent value="web">',
    "",
    webSnippet(usage),
    "",
    "</TabsContent>",
    "",
    '<TabsContent value="vue">',
    "",
    vueSnippet(usage),
    "",
    "</TabsContent>",
    "",
    '<TabsContent value="svelte">',
    "",
    svelteSnippet(usage),
    "",
    "</TabsContent>",
    "",
    '<TabsContent value="react">',
    "",
    `In React, the same control is the [${usage.react}](/docs/react/${usage.entry}) primitive of \`@audio-ui/react\`, with the same parts as React components and its value as props.`,
    "",
    "</TabsContent>",
    "",
    "</FrameworkTabs>",
    "",
    END,
  ].join("\n");
}

/** A page's text with its block written: replaced between the markers, or put under the live preview. */
export function withUsage(page: string, text: string): string {
  const block = usageBlock(page);
  if (!block) {
    return text;
  }
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start >= 0 && end > start) {
    return `${text.slice(0, start)}${block}${text.slice(end + END.length)}`;
  }
  const preview = new RegExp(`<ElementsPreview name="${page}" />\\n`);
  return text.replace(preview, (found) => `${found}\n${block}\n`);
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  const pages = await Promise.all(
    Object.keys(USAGES).map(async (page) => {
      const path = `${PAGES}/${page}.mdx`;
      const text = await Bun.file(path).text();
      return { next: withUsage(page, text), page, path, text };
    })
  );
  const stale = pages.filter(({ next, text }) => next !== text);
  if (write) {
    await Promise.all(stale.map(({ next, path }) => Bun.write(path, next)));
  }
  if (stale.length > 0 && !write) {
    console.log(
      `Usage out of date: ${stale.map(({ page }) => page).join(", ")}. Run bun scripts/element-usage.ts --write`
    );
    process.exit(1);
  }
  console.log(
    write ? `Wrote ${stale.length} page(s)` : "Every page's usage is up to date"
  );
}
