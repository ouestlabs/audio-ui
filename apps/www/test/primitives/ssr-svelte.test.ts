import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";
import FaderFixture from "./fixtures/fader.svelte";
import Fixture from "./fixtures/knob.svelte";
import MeterFixture from "./fixtures/meter.svelte";
import XYPadFixture from "./fixtures/xypad.svelte";
import { EVERY_FEATURE, serverFeatures } from "./server-html.ts";

// Components compiled for the server run apart: `bun run test:svelte-server`.
describe.skipIf(process.env.SVELTE_GENERATE !== "server")(
  "server rendering in Svelte",
  () => {
    test("the same knob.ts writes what the published React knob does", () => {
      const { body } = render(Fixture, {
        props: {
          options: {
            defaultValue: 40,
            format: { style: "unit", unit: "percent" },
            max: 100,
            min: 0,
          },
          thumbLabel: "Cutoff",
        },
      });
      expect(serverFeatures(body)).toEqual(EVERY_FEATURE);
    });

    test("the fader and the XY pad write their inputs and places", () => {
      const fader = render(FaderFixture, {
        props: {
          options: { max: 100, min: 0, value: 25 },
          thumbLabel: "Level",
        },
      }).body;
      expect(fader).toContain('type="range"');
      expect(fader).toMatch(/bottom:\s?25%/);
      const pad = render(XYPadFixture, {
        props: {
          options: { value: { x: 25, y: 75 } },
          thumbLabel: "Cursor",
        },
      }).body;
      expect(pad.match(/type="range"/g)).toHaveLength(2);
      expect(pad).toMatch(/left:\s?25%/);
    });

    test("the meter writes its channels, levels and indicators", () => {
      const { body } = render(MeterFixture, {
        props: {
          decibels: (formatted: string) => `${formatted} dB`,
          options: { max: 0, min: -60, value: [-30, -60] },
        },
      });
      expect(body.match(/role="meter"/g)).toHaveLength(2);
      expect(body).toMatch(/scaleY\(0\.5\)/);
      expect(body).toContain('aria-valuenow="-30"');
    });
  }
);
