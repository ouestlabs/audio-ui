import { describe, expect, test } from "bun:test";
import graphicEq from "@audio/eq-graphic";
import {
  GRAPHIC_EQ_BANDS,
  graphicEqBands,
  graphicEqCurve,
  graphicEqDevice,
} from "@/registry-audio/bases/base/devices/graphic-eq/device";
import { createGraphicEqEngine } from "@/registry-audio/bases/base/devices/graphic-eq/engine";

const RATE = 48_000;
const defaults = graphicEqDevice.defaults();

/** The gain of a response at a frequency, in dB. */
function gainAt(response: Float64Array, hz: number) {
  let re = 0;
  let im = 0;
  for (const [frame, sample] of response.entries()) {
    re += sample * Math.cos((2 * Math.PI * hz * frame) / RATE);
    im -= sample * Math.sin((2 * Math.PI * hz * frame) / RATE);
  }
  return 20 * Math.log10(Math.hypot(re, im));
}

describe("the graphic EQ device", () => {
  test("its ten bands are the package's: the ISO octave centres, each at Q 1.4", () => {
    const gains = [6, -4, 3, -9, 12, -12, 5, -3, 8, -6];
    const state = Object.fromEntries(
      GRAPHIC_EQ_BANDS.map((band, index) => [band.id, gains[index]])
    );
    const curve = graphicEqCurve({ ...defaults, ...state });
    const click = new Float64Array(32_768);
    click[0] = 1;
    const response = graphicEq(click, {
      fs: RATE,
      gains: Object.fromEntries(
        GRAPHIC_EQ_BANDS.map((band, index) => [band.hz, gains[index]])
      ),
    });
    for (const hz of [31.5, 45, 125, 300, 1000, 1500, 4000, 8000, 16_000]) {
      expect(curve(hz)).toBeCloseTo(gainAt(response, hz), 1);
    }
  });

  test("off, every band is flat and the output is left out", () => {
    const loud = { ...defaults, band1k: 12, enabled: false, outputDb: 6 };
    expect(graphicEqCurve(loud)(1000)).toBe(0);
    expect(graphicEqBands(loud).every((band) => band.gainDb === 0)).toBe(true);
  });

  test("the output adds to every band", () => {
    const curve = graphicEqCurve({ ...defaults, outputDb: -3 });
    expect(curve(100)).toBeCloseTo(-3, 6);
    expect(curve(10_000)).toBeCloseTo(-3, 6);
  });
});

describe("createGraphicEqEngine", () => {
  class FakeParam {
    value = 0;
    readonly targets: number[] = [];
    setTargetAtTime(value: number) {
      this.targets.push(value);
      return this;
    }
  }
  class FakeNode {
    disconnected = 0;
    connect<T>(to: T): T {
      return to;
    }
    disconnect() {
      this.disconnected += 1;
    }
  }
  class FakeGain extends FakeNode {
    readonly gain = new FakeParam();
  }
  class FakeFilter extends FakeNode {
    readonly Q = new FakeParam();
    readonly frequency = new FakeParam();
    readonly gain = new FakeParam();
    type = "";
  }
  const fakeContext = () => {
    const filters: FakeFilter[] = [];
    const ctx = {
      createBiquadFilter: () => {
        const filter = new FakeFilter();
        filters.push(filter);
        return filter;
      },
      createGain: () => new FakeGain(),
      currentTime: 0,
    };
    return { ctx: ctx as unknown as BaseAudioContext, filters };
  };

  test("plays ten peaking filters at the bands, and moves them with ramps", () => {
    const { ctx, filters } = fakeContext();
    const engine = createGraphicEqEngine(ctx, { ...defaults, band250: -6 });
    expect(filters.map((filter) => filter.type)).toEqual(
      Array.from({ length: 10 }, () => "peaking")
    );
    expect(filters.map((filter) => filter.frequency.value)).toEqual(
      GRAPHIC_EQ_BANDS.map((band) => band.hz)
    );
    expect(filters[3]?.gain.value).toBe(-6);
    expect(filters[3]?.Q.value).toBeCloseTo(1.4, 9);
    engine.update({ ...defaults, band250: 3 });
    expect(filters[3]?.gain.targets).toContain(3);
  });
});
