import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { flushSync, mount, unmount } from "svelte";
import { createApp, defineComponent, h, nextTick } from "vue";
import {
  Envelope,
  envelopeParts,
} from "@/registry/bases/shared/audio-ui/elements/envelope";
import {
  Fader,
  faderParts,
} from "@/registry/bases/shared/audio-ui/elements/fader";
import {
  Knob,
  knobParts,
} from "@/registry/bases/shared/audio-ui/elements/knob";
import {
  Meter,
  meterParts,
} from "@/registry/bases/shared/audio-ui/elements/meter";
import {
  Pad,
  PadItem,
  padParts,
} from "@/registry/bases/shared/audio-ui/elements/pad";
import {
  Piano,
  pianoParts,
} from "@/registry/bases/shared/audio-ui/elements/piano";
import EnvelopeSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Envelope.svelte";
import FaderSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Fader.svelte";
import KnobSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Knob.svelte";
import MeterSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Meter.svelte";
import PianoSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Piano.svelte";
import XYPadSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/XYPad.svelte";
import EnvelopeVue from "@/registry/bases/shared/audio-ui/elements/vue/Envelope.vue";
import FaderVue from "@/registry/bases/shared/audio-ui/elements/vue/Fader.vue";
import KnobVue from "@/registry/bases/shared/audio-ui/elements/vue/Knob.vue";
import MeterVue from "@/registry/bases/shared/audio-ui/elements/vue/Meter.vue";
import PadVue from "@/registry/bases/shared/audio-ui/elements/vue/Pad.vue";
import PadItemVue from "@/registry/bases/shared/audio-ui/elements/vue/PadItem.vue";
import PianoVue from "@/registry/bases/shared/audio-ui/elements/vue/Piano.vue";
import XYPadVue from "@/registry/bases/shared/audio-ui/elements/vue/XYPad.vue";
import {
  XYPad,
  xypadParts,
} from "@/registry/bases/shared/audio-ui/elements/xypad";

import StyledPadSvelte from "./fixtures/styled-pad.svelte";

afterEach(cleanup);

/** The pads hold their items: each framework's grid with two of them. */
function PadGrid(props: Record<string, unknown>) {
  return (
    <Pad {...props}>
      <PadItem value="kick">Kick</PadItem>
      <PadItem value="snare">Snare</PadItem>
    </Pad>
  );
}

const PadGridVue = defineComponent(
  (_props, { attrs }) =>
    () =>
      h(PadVue, attrs, () => [
        h(PadItemVue, { value: "kick" }, () => "Kick"),
        h(PadItemVue, { value: "snare" }, () => "Snare"),
      ]),
  { inheritAttrs: false }
);

const ID = /[a-z0-9_-]*(?:«|_r_|:r|v-|svelte-)[^\s"]*/gi;

/** What assistive technology and the keyboard see: every element with a role, ARIA or a tab stop, and its attributes. */
function accessibility(container: Element) {
  return [...container.querySelectorAll("*")]
    .filter(
      (node) =>
        node.matches("input, output, [role], [tabindex]") ||
        [...node.attributes].some(({ name }) => name.startsWith("aria-"))
    )
    .filter((node) => !node.closest("[aria-hidden=true]"))
    .map((node) =>
      [
        node.tagName,
        ...[...node.attributes]
          .filter(
            ({ name }) =>
              name.startsWith("aria-") ||
              ["role", "tabindex", "type", "min", "max", "step"].includes(name)
          )
          .map(({ name, value }) => `${name}=${value.replace(ID, "id")}`)
          .sort(),
      ].join(" ")
    );
}

const rootAttributes = (container: Element, slot: string) => {
  const root = container.querySelector(`[data-slot=${slot}]`);
  return [
    "data-size",
    "data-marks",
    "data-readout",
    "data-orientation",
    "data-fill",
  ].map((name) => `${name}=${root?.getAttribute(name)}`);
};

const slots = (container: Element) =>
  new Set(
    [...container.querySelectorAll("[data-slot]")].map((node) =>
      node.getAttribute("data-slot")
    )
  );

async function inVue(component: unknown, props: Record<string, unknown>) {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({ render: () => h(component as never, props) });
  app.mount(container);
  await nextTick();
  return {
    container,
    remove: () => {
      app.unmount();
      container.remove();
    },
  };
}

function inSvelte(component: unknown, props: Record<string, unknown>) {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(component as never, { props, target: container });
  flushSync();
  return {
    container,
    remove: () => {
      unmount(app);
      container.remove();
    },
  };
}

const ELEMENTS = [
  {
    name: "knob",
    parts: knobParts,
    props: {
      "aria-label": "Level",
      defaultValue: 30,
      formatValue: (value: number) => `${value} %`,
      marks: [0, { label: "50", value: 50 }, 100],
      size: "lg",
    },
    react: Knob,
    svelte: KnobSvelte,
    vue: KnobVue,
  },
  {
    name: "fader",
    parts: faderParts,
    props: {
      "aria-label": "Volume",
      defaultValue: -6,
      formatValue: (value: number) => `${value} dB`,
      marks: [-60, { label: "0", value: 0 }, 6],
      max: 6,
      min: -60,
      size: "lg",
    },
    react: Fader,
    svelte: FaderSvelte,
    vue: FaderVue,
  },
  {
    name: "meter",
    parts: meterParts,
    props: {
      "aria-label": "Output",
      marks: [-12, 0],
      size: "lg",
      value: [-12, -6],
    },
    react: Meter,
    svelte: MeterSvelte,
    vue: MeterVue,
  },
  {
    name: "xypad",
    parts: xypadParts,
    props: {
      "aria-label": "Position",
      defaultValue: { x: 30, y: 70 },
      fill: true,
      formatValue: ({ x, y }: { x: number; y: number }) => `${x} / ${y}`,
      size: "lg",
    },
    react: XYPad,
    svelte: XYPadSvelte,
    vue: XYPadVue,
  },
  {
    name: "envelope",
    parts: envelopeParts,
    props: {
      "aria-label": "Envelope",
      defaultValue: [
        { x: 0, y: 0 },
        { curve: 0.5, x: 0.3, y: 0.9 },
        { x: 1, y: 0 },
      ],
      size: "lg",
      xDomain: [0, 2000],
      xUnit: "ms",
    },
    react: Envelope,
    svelte: EnvelopeSvelte,
    vue: EnvelopeVue,
  },
  {
    name: "pad",
    parts: padParts,
    props: { "aria-label": "Drum pads", columns: 2 },
    react: PadGrid,
    svelte: StyledPadSvelte,
    vue: PadGridVue,
  },
  {
    name: "piano",
    parts: pianoParts,
    props: { "aria-label": "Piano", maxPitch: 64, minPitch: 60, size: "lg" },
    react: Piano,
    svelte: PianoSvelte,
    vue: PianoVue,
  },
];

describe.each(ELEMENTS)("the styled $name", (element) => {
  const reactTree = () => {
    const Component = element.react as ComponentType<Record<string, unknown>>;
    const { container } = render(<Component {...element.props} />);
    const tree = {
      accessibility: accessibility(container),
      root: rootAttributes(container, Object.keys(element.parts)[0] ?? ""),
    };
    cleanup();
    return tree;
  };

  test.each([
    ["Vue", () => inVue(element.vue, element.props)],
    ["Svelte", () => Promise.resolve(inSvelte(element.svelte, element.props))],
  ] as const)(
    "in %s says what the React one says, and draws every part the sheet styles",
    async (_framework, mounted) => {
      const expected = reactTree();
      expect(expected.accessibility.length).toBeGreaterThan(0);
      const { container, remove } = await mounted();
      expect(accessibility(container)).toEqual(expected.accessibility);
      expect(
        rootAttributes(container, Object.keys(element.parts)[0] ?? "")
      ).toEqual(expected.root);
      const drawn = slots(container);
      for (const part of Object.keys(element.parts)) {
        expect(drawn).toContain(part);
      }
      remove();
    }
  );
});
