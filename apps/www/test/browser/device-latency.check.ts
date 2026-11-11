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

/** How loud a sample must be, against the loudest, to count as where the sound starts. */
const ONSET = 0.05;

/**
 * Where an impulse comes out of a device's engine, at its defaults: the frame
 * of its loudest sample and the frame it starts at, less the frame it went in
 * at. A device that mixes the dry sound in, or repeats it, has a loudest
 * sample that is not the delayed one, so either may match what it declares. A
 * single sample can fall between the samples a sample-rate reducer holds, so
 * when nothing comes out, a short burst goes in instead.
 */
async function measure(entry: (typeof DEVICE_LIBRARY)[number], length: number) {
  const ctx = new OfflineAudioContext(2, RATE / 2, RATE);
  const engine = entry.create(ctx, entry.device.defaults());
  await engine.ready;
  const buffer = ctx.createBuffer(2, RATE / 2, RATE);
  for (let frame = 0; frame < length; frame += 1) {
    buffer.getChannelData(0)[AT + frame] = 0.5;
    buffer.getChannelData(1)[AT + frame] = 0.5;
  }
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
  const top = Math.abs(out[loudest] as number);
  let onset = 0;
  while (onset < out.length && Math.abs(out[onset] as number) < top * ONSET) {
    onset += 1;
  }
  engine.dispose();
  return {
    declared: Math.round(
      entry.device.latency(entry.device.defaults(), RATE) * RATE
    ),
    onset: top > 1e-4 ? onset - AT : null,
    peak: top > 1e-4 ? loudest - AT : null,
  };
}

/** The impulse first; a burst when the device lets it through unheard. */
async function measured(entry: (typeof DEVICE_LIBRARY)[number]) {
  const impulse = await measure(entry, 1);
  return impulse.peak === null ? measure(entry, 64) : impulse;
}

check(
  "MIX-012: every effect delays the sound by the latency it declares",
  async () => {
    // One device at a time: each renders on a context of its own.
    const wrong = await DEVICE_LIBRARY.filter(
      (item) => item.device.kind === "effect"
    ).reduce<Promise<string[]>>(async (found, entry) => {
      const list = await found;
      const { declared, onset, peak } = await measured(entry);
      const near = (frame: number | null) =>
        frame !== null && Math.abs(frame - declared) <= PHASE_FRAMES;
      return near(peak) || near(onset)
        ? list
        : [
            ...list,
            `${entry.device.id}: declares ${declared}, its sound starts at ${onset ?? "nothing"} and peaks at ${peak ?? "nothing"}`,
          ];
    }, Promise.resolve([]));
    assert(wrong.length === 0, wrong.join("; "));
  }
);
