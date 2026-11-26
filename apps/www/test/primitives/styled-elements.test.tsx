import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { flushSync, mount, unmount } from "svelte";
import { createApp, h, nextTick } from "vue";
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
import FaderSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Fader.svelte";
import KnobSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Knob.svelte";
import MeterSvelte from "@/registry/bases/shared/audio-ui/elements/svelte/Meter.svelte";
import FaderVue from "@/registry/bases/shared/audio-ui/elements/vue/Fader.vue";
import KnobVue from "@/registry/bases/shared/audio-ui/elements/vue/Knob.vue";
import MeterVue from "@/registry/bases/shared/audio-ui/elements/vue/Meter.vue";

afterEach(cleanup);

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
  return ["data-size", "data-marks", "data-readout", "data-orientation"].map(
    (name) => `${name}=${root?.getAttribute(name)}`
  );
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
];

describe.each(ELEMENTS)("the styled $name", (element) => {
  const reactTree = () => {
    const Component = element.react as ComponentType<Record<string, unknown>>;
    const { container } = render(<Component {...element.props} />);
    const tree = {
      accessibility: accessibility(container),
      root: rootAttributes(container, element.name),
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
      expect(rootAttributes(container, element.name)).toEqual(expected.root);
      const drawn = slots(container);
      for (const part of Object.keys(element.parts)) {
        expect(drawn).toContain(part);
      }
      remove();
    }
  );
});
