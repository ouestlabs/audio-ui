import {
  type FilterState,
  filterSettings,
  LADDER_WORKLET,
  ladderSettings,
} from "@/components/audio-ui/devices/filter/device";

/** How fast a knob follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.015;
/** How long after a ladder fades out its input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

export interface FilterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the ladders are in the graph. Until then a ladder circuit plays the clean filter. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: FilterState) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the ladders into a context once. `false` when the context cannot run worklets. */
function loadLadders(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!(worklet && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([LADDER_WORKLET], { type: "text/javascript" })
  );
  const done = worklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A filter on the Web Audio API for a `FilterState`:
 *
 * ```
 * input → biquad → clean ──┐
 *       → ladder → ladder ─┴→ wet ──┐
 *       → dry ──────────────────────┴→ output
 * ```
 *
 * The clean circuit is the biquad `filterCurve` draws, with the resonance
 * given to it in the unit it wants. A ladder circuit is an `AudioWorklet`
 * loaded from a blob, fed only while a ladder plays: until it is ready, the
 * clean filter plays for it. Off, the signal goes round both. Parameters move
 * with `setTargetAtTime`, never `.value =`, so a sweep does not click, and a
 * change of circuit fades one path out as the other comes in.
 */
export function createFilterEngine(
  ctx: BaseAudioContext,
  initial: FilterState
): FilterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const clean = ctx.createGain();
  const laddered = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  input.connect(filter).connect(clean).connect(wet).connect(output);
  laddered.connect(wet);
  input.connect(dry).connect(output);

  const first = filterSettings(initial);
  filter.type = first.type;
  filter.frequency.value = first.frequency;
  filter.Q.value = first.q;
  clean.gain.value = 1;
  laddered.gain.value = 0;
  wet.gain.value = first.wet;
  dry.gain.value = first.dry;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  let ladder: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;
  let routed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;
  let sent = "";

  /** The ladder path in when a ladder plays and is loaded, the clean one when not. */
  const route = (state: FilterState) => {
    const settings = ladderSettings(state);
    const playing = Boolean(settings && ladder);
    if (settings && ladder) {
      const message = `${settings.circuit} ${settings.type}`;
      if (message !== sent) {
        sent = message;
        ladder.port.postMessage({
          circuit: settings.circuit,
          type: settings.type,
        });
      }
      follow(ladder.parameters.get("cutoff") as AudioParam, settings.cutoff);
      follow(
        ladder.parameters.get("resonance") as AudioParam,
        settings.resonance
      );
      follow(ladder.parameters.get("drive") as AudioParam, settings.drive);
    }
    if (playing === routed) {
      return;
    }
    routed = playing;
    follow(clean.gain, playing ? 0 : 1);
    follow(laddered.gain, playing ? 1 : 0);
    clearTimeout(unfeed);
    if (playing && !fed && ladder) {
      input.connect(ladder);
      fed = true;
    } else if (!playing && fed) {
      // Once the fade is over: a ladder fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && ladder) {
          input.disconnect(ladder);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };

  const ready = loadLadders(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = ladderSettings(latest);
    ladder = new AudioWorkletNode(ctx, "audioui-ladder", {
      parameterData: {
        cutoff: settings?.cutoff ?? latest.cutoffHz,
        drive: settings?.drive ?? 1,
        resonance: settings?.resonance ?? 0,
      },
      processorOptions: {
        circuit: settings?.circuit ?? "ladder24",
        type: settings?.type ?? "lowpass",
      },
    });
    sent = settings ? `${settings.circuit} ${settings.type}` : "";
    ladder.connect(laddered);
    route(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      for (const node of [input, filter, clean, laddered, wet, dry, output]) {
        node.disconnect();
      }
      ladder?.disconnect();
    },
    input,
    output,
    ready,
    update: (state) => {
      latest = state;
      const settings = filterSettings(state);
      filter.type = settings.type;
      follow(filter.frequency, settings.frequency);
      follow(filter.Q, settings.q);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
      route(state);
    },
  };
}