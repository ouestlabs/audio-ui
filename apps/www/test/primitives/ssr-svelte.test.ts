import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";
import Fixture from "./fixtures/knob.svelte";
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
  }
);
