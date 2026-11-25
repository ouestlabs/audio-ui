import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";

mock.module("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

const { Knob } = await import("@/registry/bases/shared/audio-ui/elements/knob");
const { HardwareKnob } = await import(
  "@/registry/bases/shared/audio-ui/skins/hardware/knob"
);
const { Fader } = await import(
  "@/registry/bases/shared/audio-ui/elements/fader"
);
const { HardwareFader } = await import(
  "@/registry/bases/shared/audio-ui/skins/hardware/fader"
);
const { Meter } = await import(
  "@/registry/bases/shared/audio-ui/elements/meter"
);
const { HardwareVuMeter } = await import(
  "@/registry/bases/shared/audio-ui/skins/hardware/vu-meter"
);
const { HARDWARE_CSS } = await import(
  "@/registry/bases/shared/audio-ui/skins/hardware-css"
);
const { skinSheet } = await import("../scripts/skin-css.ts");

afterEach(cleanup);

const ID = /[a-z0-9_-]*(?:«|_r_|:r)[^\s"]*/gi;

/** What assistive technology and the keyboard see: every element with a role, ARIA or a tab stop, and its attributes. */
function accessibility(element: ReactElement) {
  const { container } = render(element);
  const tree = [...container.querySelectorAll("*")]
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
  cleanup();
  return tree;
}

describe("the Hardware skin", () => {
  test("the site's sheet is the registry's css", async () => {
    const sheet = await Bun.file(
      `${import.meta.dir}/../src/registry/styles/skins/hardware.css`
    ).text();
    expect(sheet).toBe(skinSheet(HARDWARE_CSS));
  });

  test("its knob says to assistive technology what the knob says", () => {
    const props = {
      "aria-label": "Level",
      defaultValue: 30,
      editableValue: true,
      formatValue: (value: number) => `${value} %`,
      marks: [0, { label: "50", value: 50 }, 100],
    } as const;
    const digital = accessibility(<Knob {...props} />);
    expect(digital.length).toBeGreaterThan(0);
    expect(accessibility(<HardwareKnob {...props} />)).toEqual(digital);
  });

  test.each(["vertical", "horizontal"] as const)(
    "its %s fader says what the fader says",
    (orientation) => {
      const props = {
        "aria-label": "Volume",
        defaultValue: -6,
        editableValue: true,
        formatValue: (value: number) => `${value} dB`,
        max: 6,
        min: -60,
        orientation,
      } as const;
      const digital = accessibility(<Fader {...props} />);
      expect(digital.length).toBeGreaterThan(0);
      expect(accessibility(<HardwareFader {...props} />)).toEqual(digital);
    }
  );

  test("its fader keeps the fader's own range", () => {
    const digital = accessibility(<Fader aria-label="Volume" />);
    expect(accessibility(<HardwareFader aria-label="Volume" />)).toEqual(
      digital
    );
  });

  test("its VU meter says what the meter says, channel by channel", () => {
    const props = {
      "aria-label": "Output",
      value: [-12, -6],
      warnThreshold: -12,
    } as const;
    const digital = accessibility(<Meter {...props} />);
    expect(digital.length).toBeGreaterThan(0);
    expect(accessibility(<HardwareVuMeter {...props} />)).toEqual(digital);
  });
});
