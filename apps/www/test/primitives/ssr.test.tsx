import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createSSRApp, h } from "vue";
import { renderToString as renderVue } from "vue/server-renderer";
import { Knob } from "@/registry/bases/shared/primitives/knob/react/index.tsx";
import { Knob as VueKnob } from "@/registry/bases/shared/primitives/knob/vue/index.ts";
import { EVERY_FEATURE, serverFeatures } from "./server-html.ts";

const OPTIONS = {
  defaultValue: 40,
  format: { style: "unit", unit: "percent" },
  max: 100,
  min: 0,
} as const;

/** The knob, rendered on the server. */
function html(K: typeof Knob) {
  return renderToString(
    <K.Root {...OPTIONS}>
      <K.Control>
        <K.Track />
        <K.Indicator />
        <K.Thumb aria-label="Cutoff" />
      </K.Control>
      <K.Value />
    </K.Root>
  );
}

describe("server rendering", () => {
  test("React: the knob writes every feature", () => {
    expect(serverFeatures(html(Knob))).toEqual(EVERY_FEATURE);
    expect(html(Knob)).toContain('data-slot="knob-thumb"');
  });

  test("Vue: the same knob.ts writes it too", async () => {
    const markup = await renderVue(
      createSSRApp({
        render: () =>
          h(VueKnob.Root, OPTIONS, () => [
            h(VueKnob.Control, null, () => [
              h(VueKnob.Track),
              h(VueKnob.Indicator),
              h(VueKnob.Thumb, { "aria-label": "Cutoff" }),
            ]),
            h(VueKnob.Value),
          ]),
      })
    );
    expect(serverFeatures(markup)).toEqual(EVERY_FEATURE);
  });
});
