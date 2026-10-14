import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

const kilohertz = (hz: number) => `${(hz / 1000).toFixed(1)} kHz`;
const decibels = (db: number) => `${db.toFixed(1)} dB`;

describe("formatValue", () => {
  test("a knob announces what its readout prints", () => {
    const view = render(
      <Knob
        aria-label="Cutoff"
        defaultValue={8700}
        formatValue={kilohertz}
        max={20_000}
        min={20}
      />
    );
    expect(view.getByLabelText("Cutoff").getAttribute("aria-valuetext")).toBe(
      "8.7 kHz"
    );
  });

  test("a fader announces what its readout prints", () => {
    const view = render(
      <Fader aria-label="Volume" defaultValue={-6} formatValue={decibels} />
    );
    expect(view.getByLabelText("Volume").getAttribute("aria-valuetext")).toBe(
      "-6.0 dB"
    );
  });
});
