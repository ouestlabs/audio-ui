import { DEVICE_LIBRARY } from "@/registry-audio/bases/base/lib/device-library";
import { assert, check } from "./harness.ts";

const RATE = 48_000;
const AT = 2000;
/**
 * How far an impulse's peak may land from the latency a device declares. A
 * filter in the path moves the peak by its phase (a low-pass rings for a few
 * frames before its loudest one) without delaying the sound: compensation
 * waits for delays, not for a filter's phase, so that much is not an error.
 * A delay a device forgets to declare (a look-ahead, an oversampler) is
 * hundreds of frames.
 */
const PHASE_FRAMES = 8;

/**
 * Where an impulse comes out of a device's engine, at its defaults: the frame
 * of its loudest sample, less the frame it went in at.
 */
async function measure(entry: (typeof DEVICE_LIBRARY)[number]) {
  const ctx = new OfflineAudioContext(2, RATE / 2, RATE);
  const engine = entry.create(ctx, entry.device.defaults());
  await engine.ready;
  const buffer = ctx.createBuffer(2, RATE / 2, RATE);
  buffer.getChannelData(0)[AT] = 0.5;
  buffer.getChannelData(1)[AT] = 0.5;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(engine.input as AudioNode);
  engine.output.connect(ctx.destination);
  source.start(0);
  const out = (await ctx.startRendering()).getChannelData(0);
  let loudest = 0;
  for (let index = 1; index < out.length; index += 1) {
    if (Math.abs(out[index] as number) > Math.abs(out[loudest] as number)) {
      loudest = index;
    }
  }
  engine.dispose();
  return {
    declared: Math.round(
      entry.device.latency(entry.device.defaults(), RATE) * RATE
    ),
    peak: Math.abs(out[loudest] as number) > 1e-4 ? loudest - AT : null,
  };
}

check(
  "MIX-012: every effect delays the sound by the latency it declares",
  async () => {
    // One device at a time: each renders on a context of its own.
    const wrong = await DEVICE_LIBRARY.filter(
      (item) => item.device.kind === "effect"
    ).reduce<Promise<string[]>>(async (found, entry) => {
      const list = await found;
      const { declared, peak } = await measure(entry);
      return peak === null || Math.abs(peak - declared) > PHASE_FRAMES
        ? [
            ...list,
            `${entry.device.id}: declares ${declared}, its impulse peaks at ${peak ?? "nothing"}`,
          ]
        : list;
    }, Promise.resolve([]));
    assert(wrong.length === 0, wrong.join("; "));
  }
);
