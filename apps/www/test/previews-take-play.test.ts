import { describe, expect, test } from "bun:test";
import { takesPlay } from "@/lib/registry/catalog/is-block";
import { components } from "@/registry-audio/bases/base/components/_registry";

const DEVICES = components
  .map((item) => item.name)
  .filter((name) => name.startsWith("block-"));

describe("takesPlay", () => {
  test("is true for the previews that follow their session's play switch", () => {
    for (const name of [
      "plot-demo",
      "plot-compressor-demo",
      "spectrum-analyzer-demo",
      "piano-roll-playback-demo",
      "block-delay",
      "block-reverb",
      "block-compressor",
      "block-equalizer",
      "block-gate",
    ]) {
      expect(takesPlay(name)).toBe(true);
    }
  });

  test("is false for the previews that make their own sound or none", () => {
    for (const name of [
      "knob-demo",
      "fader-vertical-demo",
      "tuner-demo",
      "block-piano-roll",
      "block-pocket-synth",
    ]) {
      expect(takesPlay(name)).toBe(false);
    }
  });

  test("holds for every effect block of the registry but the ones with a console of their own", () => {
    const effects = DEVICES.filter(
      (name) =>
        ![
          "block-drum-rack",
          "block-mixer",
          "block-pocket-synth",
          "block-wave-shaper",
          "block-piano-roll",
          "block-timeline",
          "block-waveform-player",
        ].includes(name)
    );
    expect(effects.filter((name) => !takesPlay(name))).toEqual([]);
  });
});
