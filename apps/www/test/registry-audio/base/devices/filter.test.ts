import { describe, expect, test } from "bun:test";
import { type BiquadType, biquadResponse } from "@audio-ui/core/analysis";
import {
  CIRCUIT_WORKLET,
  circuitResonance,
  circuitSettings,
  type FilterState,
  FLAT_Q,
  filterCircuit,
  filterCurve,
  filterDevice,
  resonanceDb,
  resonanceFromDb,
} from "@/registry-audio/bases/base/devices/filter/device";
import { createFilterEngine } from "@/registry-audio/bases/base/devices/filter/engine";

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
function fakeContext() {
  const made = { gains: [] as FakeGain[] };
  const ctx = {
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

/** The 2-pole filter the knob's resonance is a Q of: what the SEM and the ladders' peaks are matched to. */
const BAND: Record<FilterState["type"], BiquadType> = {
  bandpass: "bandpass",
  highpass: "lowcut",
  lowpass: "highcut",
  notch: "notch",
};
const reference = (state: FilterState) =>
  biquadResponse({
    frequency: state.cutoffHz,
    q: state.resonance,
    type: BAND[state.type],
  });

const defaults = filterDevice.defaults();

describe("the filter device", () => {
  test("off, the curve is flat", () => {
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
  test("passes the signal until the circuits are ready, and says so without worklets", async () => {
    const { ctx, made } = fakeContext();
    const engine = createFilterEngine(ctx, { ...defaults, cutoffHz: 800 });
    // input, output, wet, dry
    const [, , wet, dry] = made.gains;
    expect([wet?.gain.value, dry?.gain.value]).toEqual([0, 1]);
    expect(await engine.ready).toBe(false);
    engine.update({ ...defaults, circuit: "diode", cutoffHz: 400 });
  });

  test("dispose lets go of every node", () => {
    const { ctx, made } = fakeContext();
    createFilterEngine(ctx, defaults).dispose();
    expect(made.gains.every((gain) => gain.disconnected === 1)).toBe(true);
  });
});

describe("the filter's circuits", () => {
  const ladders = ["ladder24", "ladder12", "diode", "korg35"] as const;

  test("five circuits, the SEM the one a filter starts with", () => {
    const circuit = filterDevice.parameters.find(
      (parameter) => parameter.id === "circuit"
    );
    expect(circuit?.options?.map((option) => option.value)).toEqual([
      ...ladders,
      "sem",
    ]);
    expect(defaults.circuit).toBe("sem");
    expect(defaults.driveDb).toBe(0);
    expect(filterDevice.sanitize({ cutoffHz: 500 }).circuit).toBe("sem");
  });

  test("a circuit without the type plays the SEM, and comes back with the type", () => {
    expect(filterCircuit({ circuit: "diode", type: "highpass" })).toBe("sem");
    expect(filterCircuit({ circuit: "ladder24", type: "notch" })).toBe("sem");
    expect(filterCircuit({ circuit: "ladder24", type: "bandpass" })).toBe(
      "ladder24"
    );
    expect(filterCircuit({ circuit: "korg35", type: "highpass" })).toBe(
      "korg35"
    );
    expect(
      circuitSettings({ ...defaults, circuit: "diode", type: "notch" }).circuit
    ).toBe("sem");
  });

  test("the SEM is the 2-pole filter at the same resonance, every type of it, until it saturates", () => {
    for (const type of ["lowpass", "highpass", "bandpass", "notch"] as const) {
      for (const resonance of [0.3, FLAT_Q, 4, 18]) {
        const state = { ...defaults, cutoffHz: 1000, resonance, type };
        const clean = reference(state);
        const sem = filterCurve(state);
        let apart = 0;
        for (let hz = 20; hz < 20_000; hz *= 1.02) {
          // A notch's floor is below anything heard: compare it to -60 dB.
          apart = Math.max(
            apart,
            Math.abs(Math.max(sem(hz), -60) - Math.max(clean(hz), -60))
          );
        }
        expect({ apart: apart < 0.5, resonance, type }).toEqual({
          apart: true,
          resonance,
          type,
        });
      }
    }
  });

  test("a band-pass peaks at 0 dB at its cutoff in every circuit that has one", () => {
    for (const circuit of ["ladder24", "ladder12", "sem"] as const) {
      for (const resonance of [FLAT_Q, 4, 12]) {
        const curve = filterCurve({
          ...defaults,
          circuit,
          cutoffHz: 1000,
          resonance,
          type: "bandpass",
        });
        expect(curve(1000)).toBeCloseTo(0, 1);
      }
    }
  });

  test("the SEM has no drive: its saturation is its own", () => {
    expect(
      circuitSettings({ ...defaults, circuit: "sem", driveDb: 20 }).drive
    ).toBe(1);
  });

  test("the drive is a gain on the way in", () => {
    const settings = circuitSettings({
      ...defaults,
      circuit: "ladder24",
      driveDb: 20,
    });
    expect(settings.drive).toBeCloseTo(10, 6);
  });

  /** How far a curve's peak rises over its passband, at 30 Hz, with the cutoff at 1 kHz. */
  const peakOverCurve = (curve: (hz: number) => number, _cutoff: number) => {
    let peak = Number.NEGATIVE_INFINITY;
    for (let hz = 200; hz < 5000; hz *= 1.005) {
      peak = Math.max(peak, curve(hz));
    }
    return peak - curve(30);
  };
  const peakOver = (state: FilterState) =>
    peakOverCurve(filterCurve({ ...state, cutoffHz: 1000 }), 1000);

  for (const circuit of ["ladder24", "ladder12", "diode"] as const) {
    test(`${circuit}: its resonant peak rises as high as the 2-pole filter's`, () => {
      for (const resonance of [2, 6, 18]) {
        const flat = peakOverCurve(
          reference({ ...defaults, cutoffHz: 1000, resonance, circuit: "sem" }),
          1000
        );
        expect(peakOver({ ...defaults, circuit, resonance })).toBeCloseTo(
          flat,
          0
        );
      }
      expect(circuitResonance(circuit, FLAT_Q)).toBe(0);
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
    expect(circuitResonance("korg35", FLAT_Q)).toBe(0);
    expect(circuitResonance("korg35", 18)).toBeCloseTo(1, 6);
    expect(circuitResonance("korg35", 0.3)).toBe(0);
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
      CIRCUIT_WORKLET
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

  for (const circuit of ["ladder24", "ladder12", "diode", "korg35", "sem"]) {
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

  test("with nothing coming in, a resonance rings out", () => {
    const processor = made();
    const click = new Float32Array(128);
    click[0] = 1;
    processor.process([[click]], [[new Float32Array(128)]], parameters(1));
    const output = new Float32Array(128);
    processor.process([[]], [[output]], parameters(1));
    expect(Math.max(...output.map(Math.abs))).toBeGreaterThan(1e-4);
  });

  test("with nothing coming in, it waits", () => {
    expect(made().process([[]], [[new Float32Array(128)]], parameters(1))).toBe(
      true
    );
  });
});
