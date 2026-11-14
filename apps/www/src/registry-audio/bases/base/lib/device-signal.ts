import {
  createFrameTask,
  createSource,
  type FrameTask,
  type Source,
} from "@audio-ui/core";
import type { MeterFrame } from "@audio-ui/core/meter";
import {
  type LogSpectrumOptions,
  logSpectrum,
  peakDb,
  rmsDb,
  SPECTRUM_FLOOR_DB,
  stereoCorrelation,
} from "@audio-ui/engine/analysis";
import type {
  Device,
  DeviceReadings,
  DeviceTaps,
  ParameterDescriptor,
} from "@audio-ui/engine/device";

/** The level a meter of silence reads, in dB. */
const SILENCE_DB = -100;
/** Under this, a point counts as silent, in dB: below the noise of any sound worth showing. */
const QUIET_DB = -80;
/** How long a point stays active once it falls silent, in ms: a rest between two notes is not "no signal". */
const ACTIVE_HOLD_MS = 400;
/** How fast a level falls back once the sound drops, in dB per second; it rises at once. */
const RELEASE_DB_PER_SECOND = 30;
const PEAK_HOLD_MS = 1500;
const PEAK_FALL_DB_PER_SECOND = 12;
/** Samples a level is read over each frame: longer than a frame, so no peak falls between two reads. */
const LEVEL_SAMPLES = 2048;
/** Samples of the analyser a scope, a spectrum and a history read: 85 ms at 48 kHz. */
const MONO_SAMPLES = 4096;
/** Samples of the analyser a history reads: 680 ms at 48 kHz, so a frame that comes late still finds the samples it missed. */
const HISTORY_SAMPLES = 32_768;
const SPECTRUM_SMOOTHING = 0.8;
/** The quietest sound a fitted scope scales up to fill, as an amplitude: under it, a sound stays small. */
const FIT_QUIETEST = 0.01;
/** How much of its reach a fitted scope keeps each frame once the sound gets quieter. */
const FIT_FALLBACK = 0.97;

/**
 * What a signal listens to: a device's engine, or anything with an output.
 * An effect's engine and an instrument's both are one.
 */
export interface SignalTarget {
  readonly input?: AudioNode | null;
  readonly output: AudioNode;
  readonly readings?: () => DeviceReadings;
  /** The input of the key a sidechain listens to, on a device that takes one. */
  readonly sidechain?: AudioNode;
  readonly taps?: DeviceTaps;
}

/** The two channels of a point, their latest samples, -1 to 1, and how alike they are: what a stereo field is drawn from. */
export interface StereoSamples {
  /** How alike the two channels are, from -1 (one the other upside down) to 1 (mono), as `stereoCorrelation` reads it. */
  correlation: number;
  left: Float32Array;
  right: Float32Array;
  /** Whether both channels are silent: the correlation of silence means nothing. */
  silent: boolean;
}

export interface SpectrumOptions extends LogSpectrumOptions {
  /** How many values, spread along a log frequency axis. @default 160 */
  points?: number;
}

export interface ScopeOptions {
  /** Scales the samples so the loudest of the last moments reaches 1, as a scope's gain is set to the sound: its shape reads at any level. It rises at once and settles over about a second. @default false */
  fit?: boolean;
  /** How many samples, the newest. @default 1024 */
  length?: number;
}

export interface HistoryOptions {
  /** The newest value first and the oldest last: a window that runs back in time from its start, as a tape runs past a delay's heads. @default false, the oldest first */
  newestFirst?: boolean;
  /** What each value is: the signal itself, as a modulator's position (`"value"`), or its level in dB (`"level"`). @default "value" */
  of?: "level" | "value";
  /** How many values the window holds, spread evenly over it. @default 240 */
  points?: number;
  /** How far back it reaches, in seconds. */
  seconds: number;
}

/**
 * One point of a device's sound, such as what goes in or what comes out, read
 * as live sources. Each source listens only while something watches it: the
 * first watcher puts an analyser on the point, the last one to leave takes it
 * off, and nothing is read in between. None renders React: a meter or a plot
 * paints from it straight in the DOM.
 */
export interface SignalPoint {
  /** Whether sound passes here: `false` once it has been silent for a moment, and with nothing to listen to. */
  readonly active: Source<boolean>;
  /**
   * What the point held over the last `seconds`, oldest first: the signal
   * itself (a modulator's position, -1 to 1) or its level in dB. It scrolls
   * as time passes, and it is real samples, read between the frames.
   */
  history: (options: HistoryOptions) => Source<Float32Array>;
  /** Its level per channel, in dB: the RMS, rising at once and falling back, and the loudest sample, held a moment. What a `Meter` paints. */
  readonly levels: Source<MeterFrame>;
  /**
   * Its latest samples, from where the wave last rose through zero, so a
   * steady tone stands still: what a scope draws. -1 to 1 as they are, or,
   * with `fit`, scaled so the loudest of the last moments fills the height.
   */
  scope: (options?: ScopeOptions) => Source<Float32Array>;
  /** Its spectrum along a log frequency axis, in dB. */
  spectrum: (options?: SpectrumOptions) => Source<Float32Array>;
  /** Its two channels' latest samples: what a stereo field is drawn from. A mono sound is on both. */
  readonly stereo: Source<StereoSamples>;
}

/**
 * Everything a device's face can show of its sound, as live sources: what
 * goes in (an effect's), what comes out, the points its engine names in its
 * `taps` and the readings it reports, each one present when the device
 * declares it in `signals`.
 */
export interface DeviceSignal {
  /** What goes in. `null` for an instrument, which takes notes, not sound. */
  readonly input: SignalPoint | null;
  /** The key its sidechain listens to, for a device that takes one: what a ducker ducks for. */
  readonly key: SignalPoint | null;
  /** What moves the sound: its LFO, from -1 to 1, for a device that declares `modulator`. */
  readonly modulator: SignalPoint | null;
  readonly output: SignalPoint;
  /** What it reports of itself, read each frame: the gain it takes off, for a device that declares `gainReduction`. */
  readonly readings: Source<DeviceReadings>;
  /** Its processed sound alone, for a device that declares `wet`. */
  readonly wet: SignalPoint | null;
}

type Reader = (elapsedMs: number) => void;
const readers = new Set<Reader>();
let loop: FrameTask | null = null;

/**
 * Runs `reader` every animation frame, with every other reader of the page,
 * until the function it returns is called: one frame loop for every signal on
 * screen, asleep once nothing is watched.
 */
function everyFrame(reader: Reader): () => void {
  readers.add(reader);
  loop ??= createFrameTask((elapsed) => {
    for (const read of readers) {
      read(elapsed);
    }
    return readers.size > 0;
  });
  loop.wake();
  return () => {
    readers.delete(reader);
  };
}

/**
 * A source that starts its work when its first listener comes and stops it
 * when its last one leaves: `start` is given the publish function and
 * returns how to stop.
 */
function watchedSource<T>(
  initial: T,
  start: (publish: (value: T) => void) => () => void
): Source<T> {
  const source = createSource(initial);
  let watchers = 0;
  let stop: (() => void) | null = null;
  return {
    getSnapshot: source.getSnapshot,
    subscribe: (listener) => {
      const leave = source.subscribe(listener);
      watchers += 1;
      if (watchers === 1) {
        stop = start(source.set);
      }
      let left = false;
      return () => {
        if (left) {
          return;
        }
        left = true;
        leave();
        watchers -= 1;
        if (watchers === 0) {
          stop?.();
          stop = null;
        }
      };
    },
  };
}

interface TapNodes {
  disconnect: () => void;
  /** What the point is connected to. */
  input: AudioNode;
}

/**
 * Analysers on one point, shared by every source that reads it: made on the
 * first `use`, taken off with the last release, and moved over to the new
 * node when the point's node changes, as when a host makes the device's
 * engine again. With no node, `current` is `null`.
 */
function createTap<Nodes extends TapNodes>(
  node: () => AudioNode | null | undefined,
  make: (ctx: BaseAudioContext) => Nodes
) {
  let users = 0;
  let bound: AudioNode | null = null;
  let nodes: Nodes | null = null;
  const unbind = () => {
    if (bound && nodes) {
      try {
        bound.disconnect(nodes.input);
      } catch {
        // The engine was disposed first, and its node let go of every connection.
      }
    }
    bound = null;
  };
  return {
    current: (): Nodes | null => {
      const now = node() ?? null;
      if (now !== bound) {
        unbind();
        if (now) {
          if (nodes && nodes.input.context !== now.context) {
            nodes.disconnect();
            nodes = null;
          }
          nodes ??= make(now.context);
          now.connect(nodes.input);
          bound = now;
        }
      }
      return bound ? nodes : null;
    },
    use: () => {
      users += 1;
      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        users -= 1;
        if (users === 0) {
          unbind();
          nodes?.disconnect();
          nodes = null;
        }
      };
    },
  };
}

/** One analyser of the point's channels mixed down: for a scope, a spectrum and a history. */
function makeMono(ctx: BaseAudioContext) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = MONO_SAMPLES;
  analyser.smoothingTimeConstant = SPECTRUM_SMOOTHING;
  return { analyser, disconnect: () => analyser.disconnect(), input: analyser };
}

/** One long analyser of the point's channels mixed down: for a history. */
function makeLong(ctx: BaseAudioContext) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = HISTORY_SAMPLES;
  return { analyser, disconnect: () => analyser.disconnect(), input: analyser };
}

/** An analyser per channel, a mono sound spread to both first: for levels and a stereo field. */
function makeStereo(ctx: BaseAudioContext) {
  const spread = ctx.createGain();
  spread.channelCount = 2;
  spread.channelCountMode = "explicit";
  spread.channelInterpretation = "speakers";
  const split = ctx.createChannelSplitter(2);
  const analysers = [ctx.createAnalyser(), ctx.createAnalyser()] as const;
  spread.connect(split);
  analysers.forEach((analyser, channel) => {
    analyser.fftSize = LEVEL_SAMPLES;
    split.connect(analyser, channel);
  });
  return {
    analysers,
    disconnect: () => {
      spread.disconnect();
      split.disconnect();
    },
    input: spread,
  };
}

/** A level that rises at once and falls back, and a peak that holds and then falls. */
function createChannelFollower() {
  let level = SILENCE_DB;
  let peak = SILENCE_DB;
  let holdUntil = 0;
  return {
    step: (rms: number, loudest: number, seconds: number, now: number) => {
      level = Math.max(rms, level - RELEASE_DB_PER_SECOND * seconds, SILENCE_DB);
      if (loudest >= peak) {
        peak = loudest;
        holdUntil = now + PEAK_HOLD_MS;
      } else if (now > holdUntil) {
        peak = Math.max(loudest, peak - PEAK_FALL_DB_PER_SECOND * seconds);
      }
      return { db: level, peak };
    },
  };
}

const silentFrame = (): MeterFrame => ({
  levels: [SILENCE_DB, SILENCE_DB],
  peaks: [SILENCE_DB, SILENCE_DB],
});

const isSilentFrame = (frame: MeterFrame) =>
  frame.levels.every((db) => db <= SILENCE_DB) &&
  (frame.peaks ?? []).every((db) => db <= SILENCE_DB);

/** The point that `node` stands for, read as live sources. */
function createSignalPoint(
  node: () => AudioNode | null | undefined
): SignalPoint {
  const mono = createTap(node, makeMono);
  const long = createTap(node, makeLong);
  const stereo = createTap(node, makeStereo);

  /** The loudest sample of the last frame, in dB, and the levels: one read of the analysers shared by `levels` and `active`. */
  const meter = watchedSource<{ frame: MeterFrame; loudest: number }>(
    { frame: silentFrame(), loudest: SILENCE_DB },
    (publish) => {
      const release = stereo.use();
      const followers = [createChannelFollower(), createChannelFollower()];
      const buffers = [
        new Float32Array(LEVEL_SAMPLES),
        new Float32Array(LEVEL_SAMPLES),
      ];
      const stop = everyFrame((elapsed) => {
        const nodes = stereo.current();
        const now = performance.now();
        const levels: number[] = [];
        const peaks: number[] = [];
        let loudest = SILENCE_DB;
        followers.forEach((follower, channel) => {
          let rms = SILENCE_DB;
          let top = SILENCE_DB;
          const buffer = buffers[channel] as Float32Array<ArrayBuffer>;
          if (nodes) {
            nodes.analysers[channel]?.getFloatTimeDomainData(buffer);
            rms = Math.max(SILENCE_DB, rmsDb(buffer));
            top = Math.max(SILENCE_DB, peakDb(buffer));
          }
          loudest = Math.max(loudest, top);
          const { db, peak } = follower.step(rms, top, elapsed / 1000, now);
          levels.push(db);
          peaks.push(peak);
        });
        publish({ frame: { levels, peaks }, loudest });
      });
      return () => {
        stop();
        release();
        publish({ frame: silentFrame(), loudest: SILENCE_DB });
      };
    }
  );

  const levels = watchedSource<MeterFrame>(silentFrame(), (publish) => {
    let last = silentFrame();
    const stop = meter.subscribe(() => {
      const { frame } = meter.getSnapshot();
      // Silence is published once, not every frame.
      if (!(isSilentFrame(frame) && isSilentFrame(last))) {
        last = frame;
        publish(frame);
      }
    });
    return () => {
      stop();
      publish(silentFrame());
    };
  });

  const active = watchedSource(false, (publish) => {
    let heard = Number.NEGATIVE_INFINITY;
    let on = false;
    const stop = meter.subscribe(() => {
      const now = performance.now();
      if (meter.getSnapshot().loudest > QUIET_DB) {
        heard = now;
      }
      const next = now - heard < ACTIVE_HOLD_MS;
      if (next !== on) {
        on = next;
        publish(on);
      }
    });
    return () => {
      stop();
      publish(false);
    };
  });

  const stereoSamples = watchedSource<StereoSamples>(
    {
      correlation: 0,
      left: new Float32Array(LEVEL_SAMPLES),
      right: new Float32Array(LEVEL_SAMPLES),
      silent: true,
    },
    (publish) => {
      const release = stereo.use();
      const left = new Float32Array(LEVEL_SAMPLES);
      const right = new Float32Array(LEVEL_SAMPLES);
      const samples: StereoSamples = { correlation: 0, left, right, silent: true };
      let silent = false;
      const stop = everyFrame(() => {
        const nodes = stereo.current();
        if (nodes) {
          nodes.analysers[0].getFloatTimeDomainData(left);
          nodes.analysers[1].getFloatTimeDomainData(right);
        }
        const quiet =
          !nodes ||
          (peakDb(samples.left) < QUIET_DB && peakDb(samples.right) < QUIET_DB);
        if (!nodes) {
          samples.left.fill(0);
          samples.right.fill(0);
        }
        samples.silent = quiet;
        samples.correlation = quiet
          ? 0
          : stereoCorrelation(samples.left, samples.right);
        if (!(quiet && silent)) {
          publish(samples);
        }
        silent = quiet;
      });
      return () => {
        stop();
        release();
      };
    }
  );

  const scopes = new Map<string, Source<Float32Array>>();
  const scope = ({ fit = false, length = 1024 }: ScopeOptions = {}) => {
    const key = `${fit}:${length}`;
    const kept = scopes.get(key);
    if (kept) {
      return kept;
    }
    const made = watchedSource(new Float32Array(length), (publish) => {
      const release = mono.use();
      const buffer = new Float32Array(MONO_SAMPLES);
      const out = new Float32Array(length);
      let reach = FIT_QUIETEST;
      let silent = false;
      const stop = everyFrame(() => {
        const nodes = mono.current();
        if (nodes) {
          nodes.analyser.getFloatTimeDomainData(buffer);
        } else {
          buffer.fill(0);
        }
        // The newest window that starts where the wave rises through zero: a steady tone stands still.
        let start = buffer.length - length;
        for (let index = start; index > 0; index -= 1) {
          if (
            (buffer[index - 1] as number) < 0 &&
            (buffer[index] as number) >= 0
          ) {
            start = index;
            break;
          }
        }
        out.set(buffer.subarray(start, start + length));
        const loudest = 10 ** (peakDb(out) / 20);
        const quiet = loudest < 10 ** (QUIET_DB / 20);
        if (fit) {
          reach = Math.max(loudest, reach * FIT_FALLBACK, FIT_QUIETEST);
          for (let index = 0; index < length; index += 1) {
            out[index] = (out[index] as number) / reach;
          }
        }
        if (!(quiet && silent)) {
          publish(out);
        }
        silent = quiet;
      });
      return () => {
        stop();
        release();
        publish(new Float32Array(length));
      };
    });
    scopes.set(key, made);
    return made;
  };

  const spectra = new Map<string, Source<Float32Array>>();
  const spectrum = ({ maxHz, minHz, points = 160 }: SpectrumOptions = {}) => {
    const key = `${minHz}:${maxHz}:${points}`;
    const kept = spectra.get(key);
    if (kept) {
      return kept;
    }
    const floor = () => new Float32Array(points).fill(SPECTRUM_FLOOR_DB);
    const made = watchedSource<Float32Array>(floor(), (publish) => {
      const release = mono.use();
      const bins = new Float32Array(MONO_SAMPLES / 2);
      const out = floor();
      let resting = false;
      const stop = everyFrame(() => {
        const nodes = mono.current();
        if (!nodes) {
          if (!resting) {
            out.fill(SPECTRUM_FLOOR_DB);
            publish(out);
          }
          resting = true;
          return;
        }
        resting = false;
        nodes.analyser.getFloatFrequencyData(bins);
        publish(
          logSpectrum(bins, nodes.analyser.context.sampleRate, out, {
            maxHz,
            minHz,
          })
        );
      });
      return () => {
        stop();
        release();
        publish(floor());
      };
    });
    spectra.set(key, made);
    return made;
  };

  const histories = new Map<string, Source<Float32Array>>();
  const history = ({
    newestFirst = false,
    of = "value",
    points = 240,
    seconds,
  }: HistoryOptions) => {
    const key = `${newestFirst}:${of}:${points}:${seconds}`;
    const kept = histories.get(key);
    if (kept) {
      return kept;
    }
    const rest = of === "level" ? SILENCE_DB : 0;
    const made = watchedSource(
      new Float32Array(points).fill(rest),
      (publish) => {
        const release = long.use();
        const buffer = new Float32Array(HISTORY_SAMPLES);
        const ring = new Float32Array(points).fill(rest);
        const out = new Float32Array(points).fill(rest);
        let head = 0;
        /** Samples heard since the last whole slot, on the audio clock. */
        let carry = 0;
        let heardAt: number | null = null;
        let resting = true;
        const stop = everyFrame(() => {
          const nodes = long.current();
          if (!nodes) {
            // Nothing to listen to: the window empties, and starts again with the next sound.
            if (!resting) {
              ring.fill(rest);
              out.fill(rest);
              publish(out);
            }
            resting = true;
            heardAt = null;
            return;
          }
          resting = false;
          // Slots are counted on the audio clock, not the screen's: the window holds the samples as they played, a frame late or not.
          const { currentTime, sampleRate } = nodes.analyser.context;
          const slot = (seconds * sampleRate) / points;
          carry += heardAt === null ? 0 : (currentTime - heardAt) * sampleRate;
          heardAt = currentTime;
          const fresh = Math.min(points, Math.floor(carry / slot));
          if (fresh === 0) {
            return;
          }
          carry -= fresh * slot;
          nodes.analyser.getFloatTimeDomainData(buffer);
          // The slots that passed since the last frame, oldest first: the newest ends where the samples left over begin.
          for (let back = fresh - 1; back >= 0; back -= 1) {
            const end = Math.max(
              1,
              buffer.length - Math.round(carry + back * slot)
            );
            ring[head] =
              of === "level"
                ? Math.max(
                    SILENCE_DB,
                    rmsDb(
                      buffer.subarray(Math.max(0, end - Math.round(slot)), end)
                    )
                  )
                : (buffer[end - 1] as number);
            head = (head + 1) % points;
          }
          if (newestFirst) {
            for (let index = 0; index < points; index += 1) {
              out[index] = ring[(head - 1 - index + points) % points] as number;
            }
          } else {
            out.set(ring.subarray(head), 0);
            out.set(ring.subarray(0, head), points - head);
          }
          publish(out);
        });
        return () => {
          stop();
          release();
          publish(new Float32Array(points).fill(rest));
        };
      }
    );
    histories.set(key, made);
    return made;
  };

  return { active, history, levels, scope, spectrum, stereo: stereoSamples };
}

/**
 * A source computed from another, once per change however many watch it: a
 * face's own reading of a signal, such as a level turned into a height. While
 * nothing watches it, it does not watch `source` either. `compute` is given
 * the source's value and returns the new one; it may update one array in
 * place.
 */
export function deriveSource<From, To>(
  source: Source<From>,
  compute: (value: From) => To
): Source<To> {
  return watchedSource(compute(source.getSnapshot()), (publish) =>
    source.subscribe(() => publish(compute(source.getSnapshot())))
  );
}

/**
 * A dot on a transfer curve at the level of `levels`, the louder of its
 * channels: where the sound sits on the curve now, for a `Plot.Dot` (`x` the
 * level in, `y` what `curve` makes of it). It follows the levels without a
 * React render.
 */
export function curveDot(
  levels: Source<MeterFrame>,
  curve: (level: number) => number
): Source<{ x: number; y: number }> {
  const point = { x: SILENCE_DB, y: SILENCE_DB };
  return {
    getSnapshot: () => {
      point.x = Math.max(...levels.getSnapshot().levels);
      point.y = curve(point.x);
      return point;
    },
    subscribe: levels.subscribe,
  };
}

/**
 * Two dots on a shaper's curve, from -1 to 1, at the held peak of `levels`,
 * one each side of zero: how far along the curve the sound swings, from the
 * clean middle towards where it bends. For two `Plot.Dot`s, `positive` and
 * `negative`; they follow the levels without a React render.
 */
export function peakDots(
  levels: Source<MeterFrame>,
  curve: (input: number) => number
): Record<"negative" | "positive", Source<{ x: number; y: number }>> {
  const reach = () =>
    Math.min(1, 10 ** (Math.max(...(levels.getSnapshot().peaks ?? [])) / 20));
  const dot = (side: number) => {
    const point = { x: 0, y: 0 };
    return {
      getSnapshot: () => {
        point.x = side * reach();
        point.y = curve(point.x);
        return point;
      },
      subscribe: levels.subscribe,
    };
  };
  return { negative: dot(-1), positive: dot(1) };
}

const sameReadings = (a: DeviceReadings, b: DeviceReadings) => {
  if (a.gainReductionDb !== b.gainReductionDb) {
    return false;
  }
  const bandsA = a.bandGainReductionDb ?? {};
  const bandsB = b.bandGainReductionDb ?? {};
  const names = Object.keys(bandsA);
  return (
    names.length === Object.keys(bandsB).length &&
    names.every((name) => bandsA[name] === bandsB[name])
  );
};

/**
 * The live signal of a device, from its engine, as a face shows it: what goes
 * in and comes out, its readings, and the taps its device declares in
 * `signals` (its `modulator` and its `wet` sound). `target` is read each
 * frame, so the signal follows the engine a host makes again, and is silent
 * while there is none; nothing is listened to until a source is watched, and
 * the last watcher to leave takes every analyser off. It never changes the
 * sound: an analyser plays nothing, and nothing is connected to the output.
 *
 * ```ts
 * const signal = createDeviceSignal(() => engine, compressorDevice);
 * signal.input?.levels // what a Meter paints
 * signal.readings // the dB it takes off, as its engine reports it
 * ```
 */
export function createDeviceSignal(
  target: () => SignalTarget | null | undefined,
  device: Pick<
    Device<readonly ParameterDescriptor[]>,
    "kind" | "sidechain" | "signals"
  >
): DeviceSignal {
  const declares = (name: (typeof device.signals)[number]) =>
    device.signals.includes(name);
  const readings = watchedSource<DeviceReadings>({}, (publish) => {
    let last: DeviceReadings = {};
    const stop = everyFrame(() => {
      const now = target()?.readings?.() ?? {};
      if (!sameReadings(now, last)) {
        last = now;
        publish(now);
      }
    });
    return () => {
      stop();
      publish({});
    };
  });
  return {
    input:
      device.kind === "instrument"
        ? null
        : createSignalPoint(() => target()?.input),
    key: device.sidechain
      ? createSignalPoint(() => target()?.sidechain)
      : null,
    modulator: declares("modulator")
      ? createSignalPoint(() => target()?.taps?.modulator)
      : null,
    output: createSignalPoint(() => target()?.output),
    readings,
    wet: declares("wet") ? createSignalPoint(() => target()?.taps?.wet) : null,
  };
}
