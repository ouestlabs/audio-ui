import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createSSRApp, h } from "vue";
import { renderToString as renderVue } from "vue/server-renderer";
import { Fader } from "@/registry-audio/bases/base/primitives/fader/react.tsx";
import { Fader as VueFader } from "@/registry-audio/bases/base/primitives/fader/vue.ts";
import { XYPad } from "@/registry-audio/bases/base/primitives/xypad/react.tsx";
import { XYPad as VueXYPad } from "@/registry-audio/bases/base/primitives/xypad/vue.ts";

/** What a fader at 25 and a pad at (25, 75) hold in their server HTML, before any script runs. */
const faderFeatures = (markup: string) => ({
  input: markup.includes('type="range"'),
  place: markup.includes("bottom:25%") || markup.includes("bottom: 25%"),
  text: markup.includes(">25<"),
});
const padFeatures = (markup: string) => ({
  inputs: markup.match(/type="range"/g)?.length,
  place: markup.includes("left:25%") || markup.includes("left: 25%"),
  text: markup.includes("25") && markup.includes("75"),
});

const FADER = { input: true, place: true, text: true };
const PAD = { inputs: 2, place: true, text: true };

describe("server rendering of the fader and the XY pad", () => {
  test("React", () => {
    const fader = renderToString(
      <Fader.Root max={100} min={0} value={25}>
        <Fader.Control>
          <Fader.Track>
            <Fader.Indicator />
          </Fader.Track>
          <Fader.Thumb aria-label="Level" />
        </Fader.Control>
        <Fader.Value />
      </Fader.Root>
    );
    expect(faderFeatures(fader)).toEqual(FADER);
    const pad = renderToString(
      <XYPad.Root value={{ x: 25, y: 75 }}>
        <XYPad.Control>
          <XYPad.Thumb aria-label="Cursor" />
        </XYPad.Control>
        <XYPad.Value />
      </XYPad.Root>
    );
    expect(padFeatures(pad)).toEqual(PAD);
  });

  test("Vue", async () => {
    const fader = await renderVue(
      createSSRApp({
        render: () =>
          h(VueFader.Root, { max: 100, min: 0, value: 25 }, () => [
            h(VueFader.Control, null, () => [
              h(VueFader.Thumb, { "aria-label": "Level" }),
            ]),
            h(VueFader.Value),
          ]),
      })
    );
    expect(faderFeatures(fader)).toEqual(FADER);
    const pad = await renderVue(
      createSSRApp({
        render: () =>
          h(VueXYPad.Root, { value: { x: 25, y: 75 } }, () => [
            h(VueXYPad.Control, null, () => [
              h(VueXYPad.Thumb, { "aria-label": "Cursor" }),
            ]),
            h(VueXYPad.Value),
          ]),
      })
    );
    expect(padFeatures(pad)).toEqual(PAD);
  });
});
