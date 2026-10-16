import { autoPanDevice } from "@/registry-audio/bases/base/lib/auto-pan-device";
import { createAutoPanEngine } from "@/registry-audio/bases/base/lib/auto-pan-engine";
import {
  channelEqCurve,
  channelEqDevice,
} from "@/registry-audio/bases/base/lib/channel-eq-device";
import { createChannelEqEngine } from "@/registry-audio/bases/base/lib/channel-eq-engine";
import { chorusDevice } from "@/registry-audio/bases/base/lib/chorus-device";
import { createChorusEngine } from "@/registry-audio/bases/base/lib/chorus-engine";
import {
  compressorCurve,
  compressorDevice,
} from "@/registry-audio/bases/base/lib/compressor-device";
import { createCompressorEngine } from "@/registry-audio/bases/base/lib/compressor-engine";
import { delayDevice } from "@/registry-audio/bases/base/lib/delay-device";
import { createDelayEngine } from "@/registry-audio/bases/base/lib/delay-engine";
import {
  type EngineFactory,
  impulse,
  magnitudeDb,
  measureLatency,
  measureResponse,
  peakDb,
  peakIndex,
  render,
  reverberationTime,
  SAMPLE_RATE,
  type Signal,
  sine,
  toDb,
  toLinear,
} from "@/registry-audio/bases/base/lib/device-measure";
import {
  distortionCurve,
  distortionDevice,
} from "@/registry-audio/bases/base/lib/distortion-device";
import { createDistortionEngine } from "@/registry-audio/bases/base/lib/distortion-engine";
import {
  equalizerCurve,
  equalizerDevice,
} from "@/registry-audio/bases/base/lib/equalizer-device";
import { createEqualizerEngine } from "@/registry-audio/bases/base/lib/equalizer-engine";
import {
  filterCurve,
  filterDevice,
} from "@/registry-audio/bases/base/lib/filter-device";
import { createFilterEngine } from "@/registry-audio/bases/base/lib/filter-engine";
import { gateDevice } from "@/registry-audio/bases/base/lib/gate-device";
import { createGateEngine } from "@/registry-audio/bases/base/lib/gate-engine";
import { limiterDevice } from "@/registry-audio/bases/base/lib/limiter-device";
import { createLimiterEngine } from "@/registry-audio/bases/base/lib/limiter-engine";
import { overdriveDevice } from "@/registry-audio/bases/base/lib/overdrive-device";
import { createOverdriveEngine } from "@/registry-audio/bases/base/lib/overdrive-engine";
import { phaserDevice } from "@/registry-audio/bases/base/lib/phaser-device";
import { createPhaserEngine } from "@/registry-audio/bases/base/lib/phaser-engine";
import { reduxDevice } from "@/registry-audio/bases/base/lib/redux-device";
import { createReduxEngine } from "@/registry-audio/bases/base/lib/redux-engine";
import {
  reverbDevice,
  reverbImpulse,
} from "@/registry-audio/bases/base/lib/reverb-device";
import { createReverbEngine } from "@/registry-audio/bases/base/lib/reverb-engine";
import {
  saturatorCurve,
  saturatorDevice,
} from "@/registry-audio/bases/base/lib/saturator-device";
import { createSaturatorEngine } from "@/registry-audio/bases/base/lib/saturator-engine";
import { utilityDevice } from "@/registry-audio/bases/base/lib/utility-device";
import { createUtilityEngine } from "@/registry-audio/bases/base/lib/utility-engine";

export interface CheckResult {
  /** What it was compared to, and how far it may differ. */
  expected: string;
  /** What was measured, as text with its unit. */
  measured: string;
  pass: boolean;
}

export interface Check {
  device: string;
  id: string;
  /** The reference the result is compared to: a formula, a standard, a node's own behaviour. */
  reference: string;
  run: () => Promise<CheckResult>;
  title: string;
}

const _FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 12_000, 16_000,
];
const _IMPULSE_SECONDS = 0.5;

const result = (
  measured: string,
  expected: string,
  pass: boolean
): CheckResult => ({
  expected,
  measured,
  pass,
});
const fixed = (value: number, digits = 2) => value.toFixed(digits);

function responseCheck<State>(
  device: string,
  title: string,
  create: EngineFactory<State>,
  state: State,
  curve: (hertz: number) => number
): Check {
  return {
    device,
    id: `${device}-response`,
    reference:
      "the biquad formulas of the Audio EQ Cookbook, as the node runs them",
    run: async () => {
      const { at, worstDb: worst } = await measureResponse(
        create,
        state,
        curve
      );
      return result(
        `${fixed(worst)} dB at ${at} Hz`,
        "within 0.15 dB of the drawn curve",
        worst <= 0.15
      );
    },
    title,
  };
}

/** The settled peak of a sine at `levelDb` through an engine, in dB. */
async function sinePeak<State>(
  create: EngineFactory<State>,
  state: State,
  levelDb: number,
  seconds = 2
) {
  const [out] = await render(
    create,
    state,
    sine(997, toLinear(levelDb)),
    seconds
  );
  return out ? peakDb(out, seconds - 0.4, seconds) : Number.NEGATIVE_INFINITY;
}

export const CHECKS: Check[] = [
  responseCheck(
    "equalizer",
    "The response of the engine is the curve the panel draws",
    createEqualizerEngine,
    equalizerDevice.apply(equalizerDevice.defaults(), {
      highDb: 6,
      lowDb: -4,
      lowMidDb: 5,
      lowMidQ: 2,
      outputDb: -2,
    }).state,
    equalizerCurve(
      equalizerDevice.apply(equalizerDevice.defaults(), {
        highDb: 6,
        lowDb: -4,
        lowMidDb: 5,
        lowMidQ: 2,
        outputDb: -2,
      }).state
    )
  ),
  responseCheck(
    "channel-eq",
    "The response of the engine is the curve the panel draws",
    createChannelEqEngine,
    channelEqDevice.apply(channelEqDevice.defaults(), {
      highDb: 4,
      highPass: true,
      lowDb: 5,
      midDb: -6,
      midHz: 2000,
    }).state,
    channelEqCurve(
      channelEqDevice.apply(channelEqDevice.defaults(), {
        highDb: 4,
        highPass: true,
        lowDb: 5,
        midDb: -6,
        midHz: 2000,
      }).state
    )
  ),
  ...(["lowpass", "highpass", "bandpass", "notch"] as const).map((type) => {
    const { state } = filterDevice.apply(filterDevice.defaults(), {
      cutoffHz: 1500,
      resonance: 2,
      type,
    });
    return responseCheck(
      "filter",
      `${type}: the response of the engine is the curve the panel draws`,
      createFilterEngine,
      state,
      filterCurve(state)
    );
  }),
  {
    device: "compressor",
    id: "compressor-static",
    reference:
      "the static curve of the browser's node (threshold, ratio, knee), drawn by the panel",
    run: async () => {
      const state = compressorDevice.defaults();
      const curve = compressorCurve(state);
      const gaps = await Promise.all(
        [-40, -30, -12, -6].map(async (level) => ({
          gap: Math.abs(
            (await sinePeak(createCompressorEngine, state, level)) -
              curve(level)
          ),
          level,
        }))
      );
      const edge = state.thresholdDb - state.kneeDb;
      const worstBelow = Math.max(
        ...gaps.filter(({ level }) => level < edge).map(({ gap }) => gap)
      );
      const worstAbove = Math.max(
        ...gaps.filter(({ level }) => level >= edge).map(({ gap }) => gap)
      );
      return result(
        `${fixed(worstBelow)} dB under the knee, ${fixed(worstAbove)} dB above`,
        "within 0.3 dB under the knee and 1.5 dB above it (the detector follows the signal, the curve is static)",
        worstBelow <= 0.3 && worstAbove <= 1.5
      );
    },
    title: "A steady sine comes out where the curve says",
  },
  {
    device: "compressor",
    id: "compressor-latency",
    reference:
      "the 6 ms look-ahead of the browser's compressor node, which the dry path waits for",
    run: async () => {
      const latency = await measureLatency(
        createCompressorEngine,
        compressorDevice.defaults()
      );
      return result(
        `${fixed(latency, 2)} ms`,
        "6 ms within 0.5 ms: what a host reports to compensate it",
        Math.abs(latency - 6) <= 0.5
      );
    },
    title: "Working, it delays the signal by the look-ahead of the node",
  },
  {
    device: "limiter",
    id: "limiter-latency",
    reference:
      "the look-ahead of the browser's compressor node, plus the 4x oversampling of the clip",
    run: async () => {
      const latency = await measureLatency(
        createLimiterEngine,
        limiterDevice.defaults()
      );
      return result(
        `${fixed(latency, 2)} ms`,
        "10 ms within 0.5 ms (6 of look-ahead, 4 of oversampling): reported, so a host can compensate it",
        Math.abs(latency - 10) <= 0.5
      );
    },
    title: "Working, it delays the signal by a look-ahead",
  },
  {
    device: "limiter",
    id: "limiter-ceiling",
    reference:
      "a sample peak never above the ceiling (not an inter-sample peak)",
    run: async () => {
      const overs = await Promise.all(
        (
          [
            [-1, 24],
            [-6, 36],
            [-12, 12],
          ] as const
        ).map(async ([ceilingDb, gainDb]) => {
          const { state } = limiterDevice.apply(limiterDevice.defaults(), {
            ceilingDb,
            gainDb,
          });
          return (
            (await sinePeak(createLimiterEngine, state, 0, 1.5)) - ceilingDb
          );
        })
      );
      const worst = Math.max(...overs);
      return result(
        `${fixed(worst)} dB over the ceiling at worst`,
        "within 0.05 dB of the ceiling or under (the 4x filter rings a little), for ceilings of -1, -6 and -12 dB and 12 to 36 dB of gain",
        worst <= 0.05
      );
    },
    title: "No sample goes over the ceiling",
  },
  {
    device: "gate",
    id: "gate-levels",
    reference: "the threshold and the floor of the state",
    run: async () => {
      const { state } = gateDevice.apply(gateDevice.defaults(), {
        floorDb: -60,
        responseMs: 10,
        thresholdDb: -36,
      });
      const signal: Signal = (index) =>
        sine(997, index < SAMPLE_RATE * 0.8 ? toLinear(-6) : toLinear(-50))(
          index,
          0
        );
      const [out] = await render(createGateEngine, state, signal, 2);
      const open = out ? peakDb(out, 0.4, 0.8) : 0;
      const closed = out ? peakDb(out, 1.6, 2) : 0;
      const reduction = -50 - closed;
      return result(
        `${fixed(open - -6)} dB when open, ${fixed(reduction)} dB of reduction when closed`,
        "0.5 dB when open, 55 to 65 dB of reduction for a floor of -60 dB",
        Math.abs(open - -6) <= 0.5 && reduction >= 55 && reduction <= 65
      );
    },
    title:
      "It passes a signal over the threshold and holds one under it at the floor",
  },
  {
    device: "delay",
    id: "delay-time",
    reference: "the time and the feedback of the state",
    run: async () => {
      const { state } = delayDevice.apply(delayDevice.defaults(), {
        feedback: 50,
        mix: 100,
        timeMs: 100,
        toneHz: 20_000,
      });
      const [out] = await render(createDelayEngine, state, impulse(), 1);
      if (!out) {
        return result("no output", "an echo", false);
      }
      const first = peakIndex(out, 1);
      const second = peakIndex(out, first + Math.round(SAMPLE_RATE * 0.05));
      const time = (first / SAMPLE_RATE) * 1000;
      const ratio = Math.abs(out[second] ?? 0) / Math.abs(out[first] || 1);
      return result(
        `first echo at ${fixed(time, 1)} ms, the second ${fixed(ratio)} of it`,
        "100 ms within 0.5 ms, a second echo of 0.5 within 0.1",
        Math.abs(time - 100) <= 0.5 && Math.abs(ratio - 0.5) <= 0.1
      );
    },
    title:
      "The first echo comes at the time and the next is the feedback quieter",
  },
  {
    device: "reverb",
    id: "reverb-rt60",
    reference:
      "RT60 by Schroeder's backward integration (the method of ISO 3382)",
    run: async () => {
      const worst = await Promise.all(
        [0.6, 1.5, 3].map(async (decay) => {
          const { state } = reverbDevice.apply(reverbDevice.defaults(), {
            dampingHz: 20_000,
            decay,
            mix: 100,
            preDelayMs: 0,
          });
          const [out] = await render(
            createReverbEngine,
            state,
            impulse(),
            decay + 1
          );
          const measured = out ? reverberationTime(out) : 0;
          return Math.abs(measured - decay) / decay;
        })
      );
      const gap = Math.max(...worst) * 100;
      return result(
        `${fixed(gap, 1)} % off at worst`,
        "within 15 % of the decay for 0.6, 1.5 and 3 s",
        gap <= 15
      );
    },
    title: "The tail falls by 60 dB in the decay time",
  },
  {
    device: "reverb",
    id: "reverb-impulse",
    reference: "RT60 by Schroeder's backward integration, on the impulse alone",
    run: () => {
      const [left] = reverbImpulse(SAMPLE_RATE, {
        dampingHz: 20_000,
        decay: 2,
      });
      const measured = reverberationTime(left);
      return Promise.resolve(
        result(
          `${fixed(measured)} s for a decay of 2 s`,
          "within 15 % of 2 s",
          Math.abs(measured - 2) <= 0.3
        )
      );
    },
    title: "The impulse response a state makes has the decay it asks for",
  },
  {
    device: "utility",
    id: "utility-image",
    reference: "mid/side: M = (L + R) / 2, S = (L - R) / 2",
    run: async () => {
      const stereo: Signal = (index, channel) =>
        channel === 0 ? sine(997, 0.8)(index, 0) : 0;
      const state = utilityDevice.defaults();
      const [left, right] = await render(
        createUtilityEngine,
        state,
        stereo,
        0.5,
        2
      );
      const unity = Math.abs(
        peakDb(left ?? new Float32Array(), 0.2, 0.5) - toDb(0.8)
      );
      const silent = peakDb(right ?? new Float32Array(), 0.2, 0.5);
      const [monoLeft, monoRight] = await render(
        createUtilityEngine,
        utilityDevice.apply(state, { mono: true }).state,
        stereo,
        0.5,
        2
      );
      const half = Math.abs(
        peakDb(monoLeft ?? new Float32Array(), 0.2, 0.5) - toDb(0.4)
      );
      const equal = Math.abs(
        peakDb(monoLeft ?? new Float32Array(), 0.2, 0.5) -
          peakDb(monoRight ?? new Float32Array(), 0.2, 0.5)
      );
      return result(
        `unity ${fixed(unity)} dB off, right ${fixed(silent, 0)} dB, mono ${fixed(half)} dB off with ${fixed(equal)} dB between sides`,
        "the image unchanged at 100 % width, mono the half sum on both sides",
        unity <= 0.05 && silent <= -80 && half <= 0.05 && equal <= 0.05
      );
    },
    title: "Width 100 % leaves the image alone, mono sums it to both sides",
  },
  {
    device: "distortion",
    id: "distortion-curve",
    reference: "the transfer curve drawn by the panel",
    run: async () => {
      const { state } = distortionDevice.apply(distortionDevice.defaults(), {
        driveDb: 12,
        mix: 100,
        outputDb: 0,
      });
      const curve = distortionCurve(state);
      const gaps = await Promise.all(
        [0.05, 0.1, 0.3, 0.6].map(async (input) => {
          const [out] = await render(
            createDistortionEngine,
            state,
            () => input,
            0.5
          );
          return Math.abs((out?.[(SAMPLE_RATE * 0.4) | 0] ?? 0) - curve(input));
        })
      );
      const worst = Math.max(...gaps);
      return result(
        `${fixed(worst, 4)} off at worst`,
        "within 0.01 of the curve for a steady input",
        worst <= 0.01
      );
    },
    title: "A steady input comes out where the transfer curve says",
  },
  {
    device: "distortion",
    id: "distortion-parallel-mix",
    reference:
      "a parallel mix of two paths that meet in time: with no drive, the dry and the shaped sound add up to the input, flat",
    run: async () => {
      const { state } = distortionDevice.apply(distortionDevice.defaults(), {
        driveDb: 0,
        mix: 50,
        outputDb: 0,
        toneHz: 20_000,
      });
      // Small enough to stay on the straight part of the clip.
      const [out] = await render(
        createDistortionEngine,
        state,
        (index) => (index === 0 ? 0.01 : 0),
        0.5
      );
      const gaps = [200, 1000, 2500, 5000, 7500].map((hertz) =>
        Math.abs(out ? magnitudeDb(out, hertz) - toDb(0.01) : 99)
      );
      const worst = Math.max(...gaps);
      return result(
        `${fixed(worst)} dB from flat at worst`,
        "within 0.7 dB: a dry path that did not wait for the shaper would dip by several dB",
        worst <= 0.7
      );
    },
    title: "Mixed with its dry sound, it does not comb",
  },
  {
    device: "saturator",
    id: "saturator-curve",
    reference: "the transfer curve drawn by the panel",
    run: async () => {
      const gaps = await Promise.all(
        (["soft", "hard", "fold", "tube"] as const).flatMap((curveName) =>
          [0.1, 0.3, 0.5].map(async (input) => {
            const { state } = saturatorDevice.apply(
              saturatorDevice.defaults(),
              {
                curve: curveName,
                driveDb: 6,
                mix: 100,
                outputDb: 0,
              }
            );
            const [out] = await render(
              createSaturatorEngine,
              state,
              () => input,
              0.5
            );
            return Math.abs(
              (out?.[(SAMPLE_RATE * 0.4) | 0] ?? 0) -
                saturatorCurve(state)(input)
            );
          })
        )
      );
      const worst = Math.max(...gaps);
      return result(
        `${fixed(worst, 4)} off at worst`,
        "within 0.01 of the curve, for the four curves",
        worst <= 0.01
      );
    },
    title: "A steady input comes out where the transfer curve says",
  },
  {
    device: "redux",
    id: "redux-bits-and-hold",
    reference: "2^bits levels, and each sample held for the factor",
    run: async () => {
      const { state } = reduxDevice.apply(reduxDevice.defaults(), {
        bits: 3,
        hold: 8,
        mix: 100,
      });
      const [out] = await render(createReduxEngine, state, sine(110, 0.9), 0.5);
      const slice = Array.from(out?.slice(8192, 8192 + 4096) ?? []);
      const levels = new Set(slice.map((value) => value.toFixed(4))).size;
      let runs = 0;
      let identical = 0;
      for (let index = 0; index + 8 <= slice.length; index += 8) {
        runs += 1;
        if (
          slice.slice(index, index + 8).every((value) => value === slice[index])
        ) {
          identical += 1;
        }
      }
      return result(
        `${levels} levels, ${identical} of ${runs} runs held`,
        "at most 9 levels at 3 bits, every run of 8 samples held",
        levels <= 9 && identical === runs
      );
    },
    title: "It keeps the bits it is told to and holds each sample",
  },
  {
    device: "auto-pan",
    id: "auto-pan-swing",
    reference: "a pan that swings from one side to the other at the rate",
    run: async () => {
      const { state } = autoPanDevice.apply(autoPanDevice.defaults(), {
        depth: 100,
        mode: "pan",
        rateHz: 1,
      });
      const stereo: Signal = (index) => sine(440, 0.8)(index, 0);
      const [left, right] = await render(
        createAutoPanEngine,
        state,
        stereo,
        2,
        2
      );
      const quarter = [0.2, 0.3] as const;
      const three = [0.7, 0.8] as const;
      const a =
        peakDb(left ?? new Float32Array(), ...quarter) -
        peakDb(right ?? new Float32Array(), ...quarter);
      const b =
        peakDb(left ?? new Float32Array(), ...three) -
        peakDb(right ?? new Float32Array(), ...three);
      return result(
        `${fixed(a, 1)} dB left to right at a quarter cycle, ${fixed(b, 1)} dB at three quarters`,
        "opposite signs: the sound crosses from one side to the other",
        a * b < 0 && Math.abs(a) > 6 && Math.abs(b) > 6
      );
    },
    title: "The sound crosses from one side to the other",
  },
];

/** What an engine must do when it is off, whatever it is: let the signal through. Its delay is its latency. */
const OFF_ENGINES: {
  create: EngineFactory<never>;
  device: string;
  state: unknown;
}[] = [
  {
    create: createChannelEqEngine as never,
    device: "channel-eq",
    state: { ...channelEqDevice.defaults(), enabled: false },
  },
  {
    create: createChorusEngine as never,
    device: "chorus",
    state: { ...chorusDevice.defaults(), enabled: false },
  },
  {
    create: createCompressorEngine as never,
    device: "compressor",
    state: { ...compressorDevice.defaults(), enabled: false },
  },
  {
    create: createDelayEngine as never,
    device: "delay",
    state: { ...delayDevice.defaults(), enabled: false },
  },
  {
    create: createDistortionEngine as never,
    device: "distortion",
    state: { ...distortionDevice.defaults(), enabled: false },
  },
  {
    create: createEqualizerEngine as never,
    device: "equalizer",
    state: { ...equalizerDevice.defaults(), enabled: false },
  },
  {
    create: createFilterEngine as never,
    device: "filter",
    state: { ...filterDevice.defaults(), enabled: false },
  },
  {
    create: createGateEngine as never,
    device: "gate",
    state: { ...gateDevice.defaults(), enabled: false },
  },
  {
    create: createLimiterEngine as never,
    device: "limiter",
    state: { ...limiterDevice.defaults(), enabled: false },
  },
  {
    create: createOverdriveEngine as never,
    device: "overdrive",
    state: { ...overdriveDevice.defaults(), enabled: false },
  },
  {
    create: createPhaserEngine as never,
    device: "phaser",
    state: { ...phaserDevice.defaults(), enabled: false },
  },
  {
    create: createReduxEngine as never,
    device: "redux",
    state: { ...reduxDevice.defaults(), enabled: false },
  },
  {
    create: createReverbEngine as never,
    device: "reverb",
    state: { ...reverbDevice.defaults(), enabled: false },
  },
  {
    create: createSaturatorEngine as never,
    device: "saturator",
    state: { ...saturatorDevice.defaults(), enabled: false },
  },
  {
    create: createUtilityEngine as never,
    device: "utility",
    state: { ...utilityDevice.defaults(), enabled: false },
  },
];

let seed = 12_345;
const noise: Signal = () => {
  seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
  return ((seed / 4_294_967_296) * 2 - 1) * 0.5;
};

/** Every engine, off: the signal comes out unchanged, later by a latency that is measured. */
export const BYPASS_CHECKS: Check[] = OFF_ENGINES.map(
  ({ create, device, state }) => ({
    device,
    id: `${device}-bypass`,
    reference:
      "a device that is off is transparent: a null test against the input",
    run: async () => {
      const length = Math.round(SAMPLE_RATE * 0.5);
      const input = Float32Array.from({ length }, (_, index) =>
        noise(index, 0)
      );
      const stereo: Signal = (index) => input[index] ?? 0;
      const [left] = await render(
        create as EngineFactory<unknown>,
        state,
        stereo,
        0.6,
        2
      );
      const [pulse] = await render(
        create as EngineFactory<unknown>,
        state,
        impulse(),
        0.3,
        2
      );
      const latency = pulse ? peakIndex(pulse) : 0;
      let residual = 0;
      for (let index = 0; index + latency < length; index += 1) {
        residual = Math.max(
          residual,
          Math.abs((left?.[index + latency] ?? 0) - (input[index] ?? 0))
        );
      }
      const latencyMs = (latency / SAMPLE_RATE) * 1000;
      return result(
        `${fixed(toDb(residual), 1)} dB residual, latency ${fixed(latencyMs, 2)} ms`,
        "a residual under -60 dB once the latency is taken out; the latency is reported, not judged",
        toDb(residual) <= -60
      );
    },
    title: "Off, it lets the signal through and its latency is measured",
  })
);

export const ALL_CHECKS: Check[] = [...CHECKS, ...BYPASS_CHECKS];
