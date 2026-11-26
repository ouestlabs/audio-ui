import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";

mock.module("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

const { Knob, knobParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/knob"
);
const { Fader, faderParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/fader"
);
const { Meter, meterParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/meter"
);
const { Envelope, envelopeParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/envelope"
);
const { Pad, PadItem, padParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/pad"
);
const { Piano, pianoParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/piano"
);
const { XYPad, xypadParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/xypad"
);

afterEach(cleanup);

const STYLES = ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"];
const SHEETS = `${import.meta.dir}/../public/css`;

const slots = (container: HTMLElement) =>
  new Set(
    [...container.querySelectorAll("[data-slot]")].map((node) =>
      node.getAttribute("data-slot")
    )
  );

const ELEMENTS = [
  {
    name: "knob",
    parts: knobParts,
    root: { "data-marks": "labels", "data-size": "lg" },
    render: () =>
      render(
        <Knob
          aria-label="Level"
          editableValue
          marks={[0, { label: "50", value: 50 }, 100]}
          size="lg"
        />
      ),
  },
  {
    name: "fader",
    parts: faderParts,
    root: { "data-marks": "labels", "data-size": "lg" },
    render: () =>
      render(
        <Fader
          aria-label="Volume"
          editableValue
          marks={[0, { label: "50", value: 50 }, 100]}
          size="lg"
        />
      ),
  },
  {
    name: "meter",
    parts: meterParts,
    root: { "data-marks": "labels", "data-size": "lg" },
    render: () =>
      render(
        <Meter aria-label="Output" marks={[-12, 0]} size="lg" value={[-6]} />
      ),
  },
  {
    name: "xypad",
    parts: xypadParts,
    root: { "data-fill": "", "data-size": "lg" },
    render: () => render(<XYPad aria-label="Position" fill size="lg" />),
  },
  {
    name: "envelope",
    parts: envelopeParts,
    root: { "data-size": "lg" },
    // A point high enough has its label under it.
    render: () =>
      render(
        <Envelope
          aria-label="Envelope"
          defaultValue={[
            { x: 0, y: 0 },
            { x: 0.5, y: 0.9 },
            { x: 1, y: 0 },
          ]}
          size="lg"
        />
      ),
  },
  {
    name: "pad",
    parts: padParts,
    root: {},
    render: () =>
      render(
        <Pad aria-label="Drum pads">
          <PadItem value="kick">Kick</PadItem>
        </Pad>
      ),
  },
  {
    name: "piano",
    parts: pianoParts,
    root: { "data-size": "lg" },
    render: () =>
      render(
        <Piano aria-label="Piano" maxPitch={62} minPitch={60} size="lg" />
      ),
  },
] as const;

describe.each([...ELEMENTS])(
  "the $name, as plain CSS on its parts",
  (element) => {
    test("the React element draws every part the sheet styles, by its slot", () => {
      const { container } = element.render();
      const drawn = slots(container);
      for (const part of Object.keys(element.parts)) {
        expect(drawn).toContain(part);
      }
    });

    test("its look follows the root's attributes, which the React element sets", () => {
      const { container } = element.render();
      const root = container.querySelector(
        `[data-slot=${Object.keys(element.parts)[0]}]`
      );
      for (const [name, value] of Object.entries(element.root)) {
        expect(root?.getAttribute(name)).toBe(value);
      }
    });

    test.each(STYLES)(
      "the %s style serves a sheet for every part",
      async (style) => {
        const sheet = await Bun.file(
          `${SHEETS}/${style}/${element.name}.css`
        ).text();
        for (const part of Object.keys(element.parts)) {
          expect(sheet).toContain(`[data-slot=${part}]`);
        }
        // The sheet needs no Tailwind: no hook, no @apply, no group class is left.
        expect(sheet).not.toContain("@apply");
        expect(sheet).not.toContain(".cn-");
        expect(sheet).not.toContain(".group\\/");
      }
    );
  }
);
