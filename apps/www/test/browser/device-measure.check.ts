import { measureLatency, measureResponse } from "@audio-ui/engine/device";
import {
  equalizerCurve,
  equalizerDevice,
} from "@/registry-audio/bases/base/devices/equalizer/device";
import { createEqualizerEngine } from "@/registry-audio/bases/base/devices/equalizer/engine";
import { assert, check } from "./harness.ts";

/** An engine that only delays the sound, by `seconds`. */
const delayed = (seconds: number) => (ctx: BaseAudioContext) => {
  const delay = ctx.createDelay(1);
  delay.delayTime.value = seconds;
  return { dispose: () => delay.disconnect(), input: delay, output: delay };
};

check(
  "measureResponse: the equalizer's engine plays the curve its panel draws",
  async () => {
    const { state } = equalizerDevice.apply(equalizerDevice.defaults(), {
      highDb: 6,
      lowDb: -4,
      lowMidDb: 3,
    });
    const { at, worstDb } = await measureResponse(
      createEqualizerEngine,
      state,
      equalizerCurve(state)
    );
    assert(worstDb < 0.25, `${worstDb.toFixed(3)} dB off at ${at} Hz`);
  }
);

check(
  "measureResponse: an engine that is not the curve is caught, where it is furthest",
  async () => {
    const { at, worstDb } = await measureResponse(delayed(0), null, (hertz) =>
      hertz > 1000 ? -6 : 0
    );
    assert(Math.abs(worstDb - 6) < 0.05 && at > 1000, `${worstDb} dB at ${at}`);
  }
);

check(
  "measureLatency: a plain path has none, a delay what it is set to",
  async () => {
    const none = await measureLatency(delayed(0), null);
    const ten = await measureLatency(delayed(0.01), null);
    assert(Math.abs(none) < 0.03, `${none} ms`);
    assert(Math.abs(ten - 10) < 0.03, `${ten} ms`);
  }
);
