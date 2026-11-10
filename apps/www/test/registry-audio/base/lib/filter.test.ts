import { describe, expect, test } from "bun:test";
import {
  type FilterState,
  FLAT_Q,
  filterCircuit,
  filterCurve,
  filterDevice,
  filterSettings,
  LADDER_WORKLET,
  ladderResonance,
  ladderSettings,
  resonanceDb,
  resonanceFromDb,
} from "@/registry-audio/bases/base/lib/filter-device";
import { createFilterEngine } from "@/registry-audio/bases/base/lib/filter-engine";
import { LADDER_KERNELS } from "@/registry-audio/bases/base/lib/filter-ladders";

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
  connect<T>(destination: T): T {
    return destination;
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
  type = "";
}

function fakeContext() {
  const made = { filter: new FakeFilter(), gains: [] as FakeGain[] };
  const ctx = {
    createBiquadFilter: () => made.filter,
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const defaults = filterDevice.defaults();

describe("the filter device", () => {
  test("each type is the node's own type", () => {
    const types = (["lowpass", "highpass", "bandpass", "notch"] as const).map(
      (type) => filterSettings({ ...defaults, type }).type
    );
    expect(types).toEqual(["lowpass", "highpass", "bandpass", "notch"]);
  });

  test("a low-pass and a high-pass read the resonance in decibels, the others linear", () => {
    const q = (type: "highpass" | "lowpass" | "notch", resonance: number) =>
      filterSettings({ ...defaults, resonance, type }).q;
    expect(q("lowpass", 2)).toBeCloseTo(20 * Math.log10(2), 6);
    expect(q("highpass", 2)).toBeCloseTo(20 * Math.log10(2), 6);
    expect(q("notch", 2)).toBe(2);
  });

  test("off, the signal goes round the node", () => {
    expect(filterSettings({ ...defaults, enabled: false })).toMatchObject({
      dry: 1,
      wet: 0,
    });
    expect(filterCurve({ ...defaults, enabled: false })(500)).toBe(0);
  });

  test("a low-pass passes the lows and takes the highs, a high-pass the other way", () => {
    const low = filterCurve({ ...defaults, cutoffHz: 1000, type: "lowpass" });
    const high = filterCurve({ ...defaults, cutoffHz: 1000, type: "highpass" });
    expect(low(100)).toBeCloseTo(0, 0);
    expect(low(10_000)).toBeLessThan(-30);
    expect(high(100)).toBeLessThan(-30);
    expect(high(10_000)).toBeCloseTo(0, 0);
  });

  test("a notch takes the cutoff out, and a band-pass keeps only it", () => {
    const notch = filterCurve({
      ...defaults,
      cutoffHz: 1000,
      resonance: 4,
      type: "notch",
    });
    const band = filterCurve({
      ...defaults,
      cutoffHz: 1000,
      resonance: 4,
      type: "bandpass",
    });
    expect(notch(1000)).toBeLessThan(-30);
    expect(notch(100)).toBeCloseTo(0, 0);
    expect(band(1000)).toBeCloseTo(0, 0);
    expect(band(100)).toBeLessThan(-12);
  });

  test("the resonance and its height in dB are each other's inverse, flat at zero", () => {
    expect(resonanceDb(FLAT_Q)).toBeCloseTo(0, 6);
    expect(resonanceFromDb(resonanceDb(5))).toBeCloseTo(5, 6);
    expect(resonanceFromDb(6)).toBeCloseTo(FLAT_Q * 1.995, 2);
  });

  test("a type that is not one of the four is refused by name", () => {
    const applied = filterDevice.apply(defaults, { type: "comb" });
    expect(applied.rejected).toEqual([
      { id: "type", reason: "not one of the options" },
    ]);
  });
});

describe("createFilterEngine", () => {
  test("starts the node at the first state", () => {
    const { ctx, made } = fakeContext();
    createFilterEngine(ctx, { ...defaults, cutoffHz: 800, type: "highpass" });
    expect(made.filter.type).toBe("highpass");
    expect(made.filter.frequency.value).toBe(800);
  });

  test("an update changes the type and ramps the rest", () => {
    const { ctx, made } = fakeContext();
    const engine = createFilterEngine(ctx, defaults);
    engine.update({ ...defaults, cutoffHz: 3000, type: "notch" });
    expect(made.filter.type).toBe("notch");
    expect(made.filter.frequency.targets).toEqual([3000]);
  });

  test("off, the filtered path is silent and the dry one open", () => {
    const { ctx, made } = fakeContext();
    const engine = createFilterEngine(ctx, defaults);
    engine.update({ ...defaults, enabled: false });
    const targets = made.gains.flatMap((gain) => gain.gain.targets);
    expect(targets.sort()).toEqual([0, 1]);
  });

  test("dispose lets go of every node", () => {
    const { ctx, made } = fakeContext();
    createFilterEngine(ctx, defaults).dispose();
    expect(made.filter.disconnected).toBe(1);
    expect(made.gains.every((gain) => gain.disconnected === 1)).toBe(true);
  });
});

const PACKAGE_JSON = /package\.json$/;
const KERNEL_FILES = [
  ["@audio/filter-moog-ladder", "moog-ladder.js", "moogLadder"],
  ["@audio/filter-diode-ladder", "diode-ladder.js", "diodeLadder"],
  ["@audio/filter-korg35", "korg35.js", "korg35"],
] as const;

describe("the filter's circuits", () => {
  const ladders = ["ladder24", "ladder12", "diode", "korg35"] as const;

  test("a clean filter and four ladders, clean the one a filter starts with", () => {
    const circuit = filterDevice.parameters.find(
      (parameter) => parameter.id === "circuit"
    );
    expect(circuit?.options?.map((option) => option.value)).toEqual([
      "clean",
      ...ladders,
    ]);
    expect(defaults.circuit).toBe("clean");
    expect(defaults.driveDb).toBe(0);
    // A filter saved before the circuits plays as it did.
    expect(filterDevice.sanitize({ cutoffHz: 500 }).circuit).toBe("clean");
  });

  test("a circuit without the type plays the clean filter, and comes back with the type", () => {
    expect(filterCircuit({ circuit: "diode", type: "highpass" })).toBe("clean");
    expect(filterCircuit({ circuit: "ladder24", type: "notch" })).toBe("clean");
    expect(filterCircuit({ circuit: "ladder24", type: "bandpass" })).toBe(
      "ladder24"
    );
    expect(filterCircuit({ circuit: "korg35", type: "highpass" })).toBe(
      "korg35"
    );
    expect(
      ladderSettings({ ...defaults, circuit: "diode", type: "notch" })
    ).toBe(null);
  });

  test("the drive is a gain on the way in", () => {
    const settings = ladderSettings({
      ...defaults,
      circuit: "ladder24",
      driveDb: 20,
    });
    expect(settings?.drive).toBeCloseTo(10, 6);
  });

  /** How far a curve's peak rises over its passband, at 30 Hz, with the cutoff at 1 kHz. */
  const peakOver = (state: FilterState) => {
    const curve = filterCurve({ ...state, cutoffHz: 1000 });
    let peak = Number.NEGATIVE_INFINITY;
    for (let hz = 200; hz < 5000; hz *= 1.005) {
      peak = Math.max(peak, curve(hz));
    }
    return peak - curve(30);
  };

  for (const circuit of ["ladder24", "ladder12", "diode"] as const) {
    test(`${circuit}: its resonant peak rises as high as the clean filter's`, () => {
      for (const resonance of [2, 6, 18]) {
        const clean = peakOver({ ...defaults, resonance });
        expect(peakOver({ ...defaults, circuit, resonance })).toBeCloseTo(
          clean,
          0
        );
      }
      expect(ladderResonance(circuit, FLAT_Q)).toBe(0);
    });
  }

  test("a ladder's low-pass keeps its passband at 0 dB as the resonance rises", () => {
    for (const circuit of ladders) {
      for (const resonance of [FLAT_Q, 4, 18]) {
        const curve = filterCurve({ ...defaults, circuit, resonance });
        expect(curve(20)).toBeCloseTo(0, 1);
      }
    }
  });

  test("korg35: no peak to match, its resonance follows the knob", () => {
    expect(ladderResonance("korg35", FLAT_Q)).toBe(0);
    expect(ladderResonance("korg35", 18)).toBeCloseTo(1, 6);
    expect(ladderResonance("korg35", 0.3)).toBe(0);
  });

  /** How much a curve falls over the octave from 2 to 4 kHz, its cutoff at 500 Hz: past the knee, short of where Nyquist warps it. */
  const octaveSlope = (state: FilterState) => {
    const curve = filterCurve({ ...state, cutoffHz: 500 });
    return curve(4000) - curve(2000);
  };

  test("a 4-pole ladder falls 24 dB an octave, a 2-pole one and the Korg35 12", () => {
    expect(octaveSlope({ ...defaults, circuit: "ladder24" })).toBeCloseTo(
      -24,
      0
    );
    expect(octaveSlope({ ...defaults, circuit: "ladder12" })).toBeCloseTo(
      -12,
      0
    );
    expect(octaveSlope({ ...defaults, circuit: "korg35" })).toBeCloseTo(-12, 0);
  });

  test("a ladder's high-pass passes the highs and takes the lows", () => {
    const curve = filterCurve({
      ...defaults,
      circuit: "ladder24",
      cutoffHz: 1000,
      type: "highpass",
    });
    expect(curve(10_000)).toBeGreaterThan(-1);
    expect(curve(100)).toBeLessThan(-60);
  });

  test("the drive bends the sound, not the curve", () => {
    const state = { ...defaults, circuit: "ladder24" as const, resonance: 4 };
    const quiet = filterCurve({ ...state, driveDb: -20 });
    const loud = filterCurve({ ...state, driveDb: 20 });
    expect(loud(1000)).toBeCloseTo(quiet(1000), 6);
  });

  test("its kernels are the packages' own, as installed", async () => {
    const kept = await Promise.all(
      KERNEL_FILES.map(async ([name, file, use]) => {
        const root = Bun.resolveSync(
          `${name}/package.json`,
          import.meta.dir
        ).replace(PACKAGE_JSON, "");
        const source = await Bun.file(`${root}${file}`).text();
        return {
          kept: LADDER_KERNELS.includes(
            source.replace(`export default function ${use}`, `function ${use}`)
          ),
          name,
        };
      })
    );
    // When it fails: bun scripts/build-ladders.ts, from apps/www.
    expect(kept.filter((kernel) => !kernel.kept)).toEqual([]);
  });
});

describe("the ladders' worklet", () => {
  interface Processor {
    port: { onmessage: (event: { data: unknown }) => void };
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ) => boolean;
  }
  const made = () => {
    class AudioWorkletProcessor {
      readonly port: { onmessage: (event: { data: unknown }) => void } = {
        onmessage: () => undefined,
      };
    }
    let Made: (new (options: unknown) => Processor) | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      "sampleRate",
      LADDER_WORKLET
    )(
      AudioWorkletProcessor,
      (_name: string, processor: new (options: unknown) => Processor) => {
        Made = processor;
      },
      48_000
    );
    if (!Made) {
      throw new Error("The worklet registered no processor");
    }
    return new Made({
      processorOptions: { circuit: "ladder24", type: "lowpass" },
    });
  };
  const parameters = (drive: number) => ({
    cutoff: new Float32Array([800]),
    drive: new Float32Array([drive]),
    resonance: new Float32Array([0.6]),
  });
  const noise = () => {
    let seed = 3;
    return new Float32Array(128).map(() => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed / 2_147_483_647 - 0.5;
    });
  };

  test("plays the package's ladder, its output brought back by the drive and the passband's loss", async () => {
    const { default: moogLadder } = await import("@audio/filter-moog-ladder");
    const processor = made();
    const input = noise();
    const output = new Float32Array(128);
    expect(processor.process([[input]], [[output]], parameters(4))).toBe(true);
    const expected = moogLadder(input.slice(), {
      drive: 4,
      fc: 800,
      fs: 48_000,
      poles: 4,
      resonance: 0.6,
      type: "lowpass",
    });
    for (const [frame, sample] of output.entries()) {
      expect(sample).toBeCloseTo(
        ((expected[frame] ?? 0) * (1 + 4 * 0.6) * Math.tanh(1)) / Math.tanh(4),
        6
      );
    }
  });

  test("a message picks another circuit, from rest", async () => {
    const { default: diodeLadder } = await import("@audio/filter-diode-ladder");
    const processor = made();
    processor.process([[noise()]], [[new Float32Array(128)]], parameters(1));
    processor.port.onmessage({ data: { circuit: "diode", type: "lowpass" } });
    const input = noise();
    const output = new Float32Array(128);
    processor.process([[input]], [[output]], parameters(1));
    const expected = diodeLadder(input.slice(), {
      drive: 1,
      fc: 800,
      fs: 48_000,
      resonance: 0.6,
    });
    expect(output[127]).toBeCloseTo((expected[127] ?? 0) * (1 + 4 * 0.6), 6);
  });

  for (const circuit of ["ladder24", "ladder12", "diode", "korg35"]) {
    test(`${circuit}: a resonant low-pass lets a steady level through as it came in`, () => {
      const processor = made();
      processor.port.onmessage({ data: { circuit, type: "lowpass" } });
      const output = new Float32Array(128);
      for (let block = 0; block < 400; block += 1) {
        processor.process(
          [[new Float32Array(128).fill(1e-3)]],
          [[output]],
          parameters(1)
        );
      }
      expect(output[127] ?? 0).toBeCloseTo(1e-3, 5);
    });
  }

  test("with nothing coming in, it waits", () => {
    expect(made().process([[]], [[new Float32Array(128)]], parameters(1))).toBe(
      true
    );
  });
});

describe("the filter engine's ladders", () => {
  test("a context with no worklets keeps the clean filter, and says so", async () => {
    const { ctx, made } = fakeContext();
    const engine = createFilterEngine(ctx, {
      ...defaults,
      circuit: "ladder24",
    });
    expect(await engine.ready).toBe(false);
    engine.update({ ...defaults, circuit: "diode", cutoffHz: 400 });
    expect(made.filter.frequency.targets).toEqual([400]);
  });
});
