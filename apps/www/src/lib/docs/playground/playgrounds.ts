/**
 * The playgrounds of the docs: the props of an element the customizer's
 * Component tab sets, the props the element takes for them, and the code of
 * each framework that writes it. The code is printed for each framework by
 * hand, as its users write it, never translated from React's.
 */

export type PlaygroundName = "fader" | "knob" | "meter";
export type Framework = "react" | "svelte" | "vue" | "web";

/** A setting of the Component tab: one of a few values, the first the default. */
export interface Control {
  label: string;
  name: string;
  options: readonly string[];
}

/** The settings of a playground, by control name. */
export type Values = Record<string, string>;

const SIZE = ["default", "sm", "lg"] as const;

export const PLAYGROUNDS: Record<
  PlaygroundName,
  { controls: readonly Control[]; defaults: Values }
> = {
  fader: {
    controls: [
      {
        label: "Orientation",
        name: "orientation",
        options: ["vertical", "horizontal"],
      },
      { label: "Size", name: "size", options: SIZE },
      { label: "Scale", name: "scale", options: ["labels", "ticks", "none"] },
      {
        label: "Readout",
        name: "readout",
        options: ["auto", "always", "hidden"],
      },
      { label: "Grip lines", name: "grips", options: ["3", "5", "0"] },
    ],
    defaults: {},
  },
  knob: {
    controls: [
      {
        label: "Size",
        name: "size",
        options: ["lg", "xs", "sm", "default", "xl"],
      },
      { label: "Scale", name: "scale", options: ["labels", "ticks", "none"] },
      {
        label: "Readout",
        name: "readout",
        options: ["auto", "always", "hidden"],
      },
      {
        label: "Drag",
        name: "drag",
        options: ["circular", "vertical", "revolution"],
      },
    ],
    defaults: {},
  },
  meter: {
    controls: [
      {
        label: "Orientation",
        name: "orientation",
        options: ["vertical", "horizontal"],
      },
      { label: "Size", name: "size", options: SIZE },
      { label: "Scale", name: "scale", options: ["labels", "none"] },
      { label: "Peak", name: "peak", options: ["visible", "hidden"] },
    ],
    defaults: {},
  },
};

for (const playground of Object.values(PLAYGROUNDS)) {
  playground.defaults = Object.fromEntries(
    playground.controls.map((control) => [
      control.name,
      control.options[0] ?? "",
    ])
  );
}

export const isPlayground = (name: unknown): name is PlaygroundName =>
  typeof name === "string" && name in PLAYGROUNDS;

type Mark = number | { label: string; value: number };

const LABELED: readonly Mark[] = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];
const TICKS: readonly Mark[] = [0, 25, 50, 75, 100];
const DECIBELS = [6, 0, -6, -12, -20, -30, -40, -60];

const MARKS: Record<string, readonly Mark[] | undefined> = {
  labels: LABELED,
  ticks: TICKS,
};

const marksOf = (scale: string) => MARKS[scale];

/** A setting as the playground offers it: a value its control does not list is its default, so nothing else reaches the code. */
function setting(name: PlaygroundName, values: Values) {
  return (control: string) => {
    const options = PLAYGROUNDS[name].controls.find(
      (each) => each.name === control
    )?.options;
    const value = values[control];
    return value !== undefined && options?.includes(value)
      ? value
      : (PLAYGROUNDS[name].defaults[control] ?? "");
  };
}

/** A prop and its value, in the order the code writes them. */
export type Prop = readonly [name: string, value: unknown];

/**
 * The props of the element for a playground's values, framework-free, in
 * camelCase: what React's element takes, Vue's `h()` and Svelte's `mount()`.
 * A value equal to the element's own default is left out.
 */
export function propsOf(name: PlaygroundName, values: Values): Prop[] {
  const at = setting(name, values);
  const props: (Prop | false)[] =
    name === "meter"
      ? [
          ["aria-label", "Output"],
          at("scale") === "labels" && ["marks", DECIBELS],
          at("orientation") !== "vertical" && [
            "orientation",
            at("orientation"),
          ],
          at("peak") === "hidden" && ["peakMarks", "hidden"],
          at("size") !== "default" && ["size", at("size")],
          ["value", [-12, -6]],
          ["warnThreshold", -12],
        ]
      : [
          ["aria-label", name === "knob" ? "Level" : "Volume"],
          ["defaultValue", 50],
          name === "knob" &&
            at("drag") !== "circular" && ["dragMode", at("drag")],
          marksOf(at("scale")) !== undefined && ["marks", marksOf(at("scale"))],
          ["max", 100],
          ["min", 0],
          name === "fader" &&
            at("orientation") !== "vertical" && [
              "orientation",
              at("orientation"),
            ],
          at("size") !== "default" && ["size", at("size")],
          ["step", 1],
          name === "fader" &&
            at("grips") !== "3" && [
              "thumbMarks",
              at("grips") === "0" ? false : Number(at("grips")),
            ],
          at("readout") !== "auto" && ["valueLabel", at("readout")],
        ];
  return props.filter((prop): prop is Prop => prop !== false);
}

/** A value as a script literal: double quotes, or single ones inside a Vue attribute. */
function literal(value: unknown, quote: '"' | "'" = '"'): string {
  if (Array.isArray(value)) {
    return `[${value.map((each) => literal(each, quote)).join(", ")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).map(
      ([key, each]) => `${key}: ${literal(each, quote)}`
    );
    return `{ ${entries.join(", ")} }`;
  }
  return typeof value === "string" ? `${quote}${value}${quote}` : String(value);
}

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const COMPONENT: Record<PlaygroundName, string> = {
  fader: "Fader",
  knob: "Knob",
  meter: "Meter",
};

/** A tag's attributes, one a line when they do not fit on one. */
function tag(open: string, attributes: string[], indent: string) {
  const inline = `${open} ${attributes.join(" ")} />`;
  return inline.length + indent.length <= 80
    ? `${indent}${inline}`
    : `${indent}${open}\n${attributes.map((each) => `${indent}  ${each}`).join("\n")}\n${indent}/>`;
}

function react(name: PlaygroundName, props: Prop[]) {
  const component = COMPONENT[name];
  const attributes = props.map(([prop, value]) =>
    typeof value === "string"
      ? `${prop}="${value}"`
      : `${prop}={${literal(value)}}`
  );
  return `import { ${component} } from "@/components/audio-ui/${name}"

export function Example() {
  return (
${tag(`<${component}`, attributes, "    ")}
  )
}
`;
}

function vue(name: PlaygroundName, props: Prop[]) {
  const component = COMPONENT[name];
  const attributes = props.map(([prop, value]) =>
    typeof value === "string"
      ? `${prop.startsWith("aria-") ? prop : kebab(prop)}="${value}"`
      : `:${kebab(prop)}="${literal(value, "'")}"`
  );
  return `<script setup lang="ts">
import ${component} from "@/components/audio-ui/${name}/${component}.vue"
</script>

<template>
${tag(`<${component}`, attributes, "  ")}
</template>
`;
}

function svelte(name: PlaygroundName, props: Prop[]) {
  const component = COMPONENT[name];
  const attributes = props.map(([prop, value]) =>
    typeof value === "string"
      ? `${prop}="${value}"`
      : `${prop}={${literal(value)}}`
  );
  return `<script lang="ts">
import ${component} from "$lib/components/audio-ui/${name}/${component}.svelte"
</script>

${tag(`<${component}`, attributes, "")}
`;
}

const NEEDLE =
  '<svg aria-hidden="true" data-slot="knob-needle" viewBox="0 0 48 48"><line stroke="currentColor" stroke-linecap="round" stroke-width="2.75" x1="24" x2="24" y1="11.53" y2="18.84" /></svg>';

const markOf = (mark: Mark) =>
  typeof mark === "number" ? { label: undefined, value: mark } : mark;

/** The custom elements' markup: the parts the styled component would write, with the attributes its sheet reads. */
export function webMarkup(name: PlaygroundName, values: Values) {
  const props = Object.fromEntries(propsOf(name, values)) as Record<
    string,
    unknown
  >;
  const at = setting(name, values);
  const scale = at("scale") === "none" ? undefined : at("scale");
  const readout = at("readout") === "hidden" ? undefined : at("readout");
  const data = [
    `data-size="${at("size")}"`,
    scale ? `data-marks="${scale}"` : "",
    readout && name !== "meter" ? `data-readout="${readout}"` : "",
  ].filter(Boolean);
  if (name === "meter") {
    const orientation = at("orientation");
    const channels = [0, 1]
      .map(
        (
          index
        ) => `  <audio-ui-meter-channel aria-label="Output ${index + 1}" index="${index}">
    <audio-ui-meter-indicator></audio-ui-meter-indicator>${at("peak") === "visible" ? "\n    <audio-ui-meter-peak></audio-ui-meter-peak>" : ""}
  </audio-ui-meter-channel>`
      )
      .join("\n");
    const marks = scale
      ? DECIBELS.map(
          (level) => `  <audio-ui-meter-mark value="${level}">
    <span aria-hidden="true" data-orientation="${orientation}" data-slot="meter-mark-tick"></span>
    <span data-slot="meter-mark-label">${level}</span>
  </audio-ui-meter-mark>`
        ).join("\n")
      : "";
    return `<audio-ui-meter aria-label="Output" ${data.join(" ")} orientation="${orientation}" scale="iec" value="[-12, -6]" warn-threshold="-12">
${[channels, marks].filter(Boolean).join("\n")}
</audio-ui-meter>`;
  }
  const marks = ((props.marks as Mark[] | undefined) ?? []).map(markOf);
  if (name === "knob") {
    const drag = at("drag") === "circular" ? "" : ` drag-mode="${at("drag")}"`;
    const markup = marks
      .map(
        ({ label, value }) =>
          `  <audio-ui-knob-mark value="${value}"><span data-slot="knob-mark-tick"></span>${label === undefined ? "" : `<span data-slot="knob-mark-label">${label}</span>`}</audio-ui-knob-mark>`
      )
      .join("\n");
    return `<audio-ui-knob ${data.join(" ")} default-value="50"${drag} max="100" min="0" step="1">
  <audio-ui-knob-control>
    <div data-slot="knob-body"></div>
    <audio-ui-knob-track></audio-ui-knob-track>
    <audio-ui-knob-indicator></audio-ui-knob-indicator>
    <audio-ui-knob-thumb aria-label="Level">${NEEDLE}</audio-ui-knob-thumb>
  </audio-ui-knob-control>${markup ? `\n${markup}` : ""}${readout ? "\n  <audio-ui-knob-value></audio-ui-knob-value>" : ""}
</audio-ui-knob>`;
  }
  const orientation = at("orientation");
  const grips = Number(at("grips"));
  const scaleMarkup = marks.length
    ? `\n    <div aria-hidden="true" data-slot="fader-scale">\n${marks
        .map(
          ({ label, value }) =>
            `      <audio-ui-fader-mark value="${value}"><span data-slot="fader-mark-tick"></span>${label === undefined ? "" : `<span data-slot="fader-mark-label">${label}</span>`}</audio-ui-fader-mark>`
        )
        .join("\n")}\n    </div>`
    : "";
  const grip = `<div data-orientation="${orientation}" data-slot="fader-thumb-mark"></div>`;
  return `<audio-ui-fader ${data.join(" ")} default-value="50" max="100" min="0" orientation="${orientation}" step="1">
  <audio-ui-fader-control>
    <audio-ui-fader-track>
      <audio-ui-fader-indicator></audio-ui-fader-indicator>
    </audio-ui-fader-track>${scaleMarkup}
    <audio-ui-fader-thumb aria-label="Volume">
      <div data-orientation="${orientation}" data-slot="fader-thumb-inner">${grip.repeat(grips)}</div>${readout ? "\n      <audio-ui-fader-value></audio-ui-fader-value>" : ""}
    </audio-ui-fader-thumb>
  </audio-ui-fader-control>
</audio-ui-fader>`;
}

function web(name: PlaygroundName, values: Values) {
  return `<!-- Once, in the page: the custom elements and the sheets. -->
<script type="module" src="./components/audio-ui/${name}/web.ts"></script>
<link rel="stylesheet" href="./components/audio-ui/css/index.css" />

${webMarkup(name, values)}
`;
}

/** The code of a playground for a framework, and the file it is shown as. */
export function codeOf(
  name: PlaygroundName,
  framework: Framework,
  values: Values
): { code: string; file: string; language: string } {
  const props = propsOf(name, values);
  const add = `npx @audio-ui/cli add ${name}`;
  switch (framework) {
    case "vue":
      return {
        code: `<!-- ${add} -->\n${vue(name, props)}`,
        file: "Example.vue",
        language: "vue",
      };
    case "svelte":
      return {
        code: `<!-- ${add} -->\n${svelte(name, props)}`,
        file: "Example.svelte",
        language: "svelte",
      };
    case "web":
      return {
        code: `<!-- ${add} -->\n${web(name, values)}`,
        file: "index.html",
        language: "html",
      };
    default:
      return {
        code: `// ${add}\n${react(name, props)}`,
        file: "example.tsx",
        language: "tsx",
      };
  }
}
