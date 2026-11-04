import type { DeviceContext } from "@audio-ui/core/device";
import {
  arrangementFrame,
  heardFrame,
  PAGE_FRAMES,
  type PageRequest,
  type PlaybackState,
  type PlayedClip,
  pagesAhead,
  playedClips,
  rescaled,
  STOPPED,
  startsInWindow,
  toFrames,
} from "@audio-ui/core/playback";
import {
  type MetronomeRhythm,
  metronomeClicks,
  secondsPerBar,
} from "@audio-ui/core/time";
import {
  type Arranged,
  type ArrangementTrack,
  type AutomatedParameter,
  DRUM_RACK_DEVICE,
  INSTRUMENT_RACK_DEVICE,
  mixAt,
  mixOf,
  playedNotes,
  type Rack,
  type TrackDevice,
} from "@/lib/arrangement";
import {
  type ArrangementDoc,
  allTracks,
} from "@/lib/arrangement-state";
import {
  type ClipPlayer,
  createClipPlayer,
  loadClipPlayer,
  type RecordingSource,
  streamedRecording,
  wantPages,
} from "@/lib/clip-player";
import {
  type AnyDeviceState,
  type LibraryDevice,
  type LibraryEngine,
  libraryDevice,
} from "@/lib/device-library";
import {
  createDrumRackEngine,
  type DrumRackEngine,
  type PadRecording,
} from "@/lib/drum-rack";
import { triggerClick } from "@/lib/drum-synthesis";
import {
  createInstrumentRackEngine,
  type InstrumentRackEngine,
} from "@/lib/instrument-rack";
import {
  type ChainLink,
  createMixer,
  type Mixer,
  type MixerState,
  type MixerStrip,
} from "@/lib/mixer-engine";
import {
  createRackEngine,
  type RackEngine,
} from "@/lib/rack";
import {
  createVoicePool,
  type VoicePool,
} from "@/lib/voice-pool";

/**
 * How far ahead a play is scheduled, so every part of the engine has heard of
 * it before its first frame. A message reaches a worklet within one render
 * callback of the frame the clock reads (5.3 ms at 48 kHz, measured with 32
 * tracks playing): this is a little over twice that.
 */
export const START_SECONDS = 0.012;
/** How far ahead of the clock notes and automation are scheduled, and how often the scheduler wakes. */
const LOOKAHEAD_SECONDS = 0.1;
/** How far ahead of playback the pages of streamed recordings are asked for, the first half second before the rest. */
const PAGES_AHEAD_SECONDS = 4;
const PAGES_FIRST_SECONDS = 0.5;
/** The pages are asked for every fourth tick of the scheduler: ten times a second. */
const PREFETCH_TICKS = 4;
const POLL_MS = 25;
/** The id of the note a panel's pad holds. */
const PAD_NOTE = "hand-pad";
/** How many notes a MIDI track plays at once by default: one voice of its instrument each. */
const VOICES = 8;

/** A note of a MIDI track, in frames of the arrangement. */
interface FrameNote {
  /** The frame it ends at, kept inside the loop when the loop plays it. */
  end: number;
  id: string;
  note: Arranged["notes"] extends readonly (infer N)[] | undefined ? N : never;
  pitch: number;
  start: number;
}

interface PlacedDevice {
  /** Stands in for the device when it is switched off: it waits as long as the device would. */
  bypass: DelayNode | null;
  /** The track device it plays, as it was last given. */
  device: TrackDevice;
  engine: LibraryEngine | RackEngine;
  /** The device of the library it is; a rack is none. */
  entry: LibraryDevice | null;
  state: TrackDevice["state"];
}

/** How long a placed device delays the sound, in seconds: a rack, as long as its slowest chain. */
function placedLatency(placed: PlacedDevice, sampleRate: number): number {
  return placed.entry
    ? placed.entry.device.latency(
        placed.entry.device.sanitize(placed.state),
        sampleRate
      )
    : (placed.engine as RackEngine).latency();
}

/** The recordings a drum rack's pads can play: the decoded ones, not those streamed from disk. */
function padRecordings(
  recordings: ReadonlyMap<string, RecordingSource>
): ReadonlyMap<string, PadRecording> {
  return new Map(
    [...recordings].filter(
      (entry): entry is [string, PadRecording] =>
        "getChannelData" in entry[1] || "channels" in entry[1]
    )
  );
}

/** The instrument at the head of a MIDI track, by the kind of track device it plays, as it was last given, with the recordings it had then. */
type TrackInstrument = {
  device: TrackDevice;
  recordings: ReadonlyMap<string, RecordingSource>;
} & (
  | { kind: "drums"; player: DrumRackEngine }
  | { kind: "layers"; player: InstrumentRackEngine }
  | { kind: "voices"; player: VoicePool }
);

/** How long a track's instrument delays the sound, in seconds: a rack, as long as its slowest chain. */
const instrumentLatency = (instrument: TrackInstrument | null) =>
  instrument && instrument.kind !== "voices" ? instrument.player.latency() : 0;

interface TrackRuntime {
  chainKey: string;
  clips: readonly Arranged[] | null;
  devices: Map<string, PlacedDevice>;
  /** What a MIDI track's notes play through: its instrument's voices, a drum rack or an instrument rack. */
  instrument: TrackInstrument | null;
  notes: FrameNote[];
  /** What its clip player plays, as it was last given: what the pages of streamed recordings are planned from. */
  played: PlayedClip[];
  player: ClipPlayer | null;
}

/** What the metronome does. It is off until it is set, so an export never clicks. */
export interface MetronomeSettings {
  on: boolean;
  /** How often it clicks. @default "auto", the beats of the signature in force */
  rhythm?: MetronomeRhythm;
}

export interface ArrangementEngineOptions {
  /** Where the main track goes. @default the context's destination */
  destination?: AudioNode;
  /** Finds a device by the stable id a track stores. @default the registry's `libraryDevice` */
  library?: (id: string) => LibraryDevice | undefined;
  /** How many notes a MIDI track's instrument plays at once. @default 8 */
  voices?: number;
}

export interface ArrangementEngine {
  /**
   * Loads, while stopped, the pages of streamed recordings that a play from
   * `from` seconds would read first, so it starts with its sound there;
   * resolves once they are in. A host calls it when the cursor moves.
   */
  cue: (from: number) => Promise<void>;
  dispose: () => void;
  /**
   * Holds a note on a MIDI track's instrument now, by the instrument's own
   * note parameters (a pad's pitch and cutoff), as its panel's pad plays it:
   * called again while held, the same voice follows; `null` lets it go.
   */
  holdNote: (
    track: string,
    note: Readonly<Record<string, number>> | null
  ) => void;
  /** The frames the engine delays its sound by: its delay compensation. */
  readonly latency: number;
  /**
   * Loads the pages of streamed recordings the clock's frames from `from` to
   * `to` read; resolves once they are in. What an offline render waits for
   * before it renders those frames.
   */
  load: (from: number, to: number) => Promise<void>;
  readonly mixer: Mixer;
  /** Lets go of a note `noteOn` started on a MIDI track. */
  noteOff: (track: string, pitch: number) => void;
  /** Plays a note on a MIDI track's instrument now, through its chain, as a key of its editor does, until `noteOff`. */
  noteOn: (track: string, pitch: number, velocity?: number) => void;
  /** Plays from `from` seconds of the arrangement, starting `START_SECONDS` from now (at the clock's frame `at` when given), round the loop when it is on. */
  play: (from: number, at?: number) => void;
  readonly playing: boolean;
  /** Where playback is, in seconds of the arrangement: what the speakers play now. Stopped, where it stopped. */
  position: () => number;
  /** Resolves once every clip player has heard everything and every device is in the graph: what an offline render waits for. */
  ready: () => Promise<void>;
  /** Schedules the notes and the automation from the clock's frame `from` to `to`: what an offline render calls step by step. */
  schedule: (from: number, to: number) => void;
  /** Sets the metronome: it clicks on the audio clock, straight to the output, never through a track or the main track's meter. */
  setMetronome: (settings: MetronomeSettings) => void;
  /** Stops playback: the clips and the notes stop, the effects' tails ring on. */
  stop: () => void;
  /**
   * Keeps the graph in step with the document: a track, a device, a clip, a
   * mix or a send changed is changed in the graph without stopping playback.
   * `overridden` lists, by track, what a change by hand took from its
   * automation.
   */
  update: (
    doc: ArrangementDoc,
    recordings: ReadonlyMap<string, RecordingSource>,
    overridden?: Readonly<Record<string, readonly AutomatedParameter[]>>
  ) => void;
}

/** The notes a MIDI track plays, in frames of the arrangement, in the order they start. */
function framesOf(clips: readonly Arranged[], sampleRate: number): FrameNote[] {
  const notes: FrameNote[] = [];
  for (const clip of clips) {
    if (clip.disabled || !clip.notes) {
      continue;
    }
    for (const note of playedNotes(clip)) {
      if (!note.muted) {
        const start = toFrames(note.start, sampleRate);
        notes.push({
          end: Math.max(
            start + 1,
            toFrames(note.start + note.length, sampleRate)
          ),
          id: String(note.id),
          note,
          pitch: note.pitch,
          start,
        });
      }
    }
  }
  return notes.sort((a, b) => a.start - b.start);
}

/** The document's loop in frames, while it is on and lasts. */
function loopOf(
  doc: ArrangementDoc,
  sampleRate: number
): readonly [number, number] | null {
  const { on, range } = doc.loop;
  return on && range[1] > range[0]
    ? [toFrames(range[0], sampleRate), toFrames(range[1], sampleRate)]
    : null;
}

const sameLoop = (a: ArrangementDoc["loop"], b: ArrangementDoc["loop"]) =>
  a.on === b.on && a.range[0] === b.range[0] && a.range[1] === b.range[1];

/** What a device's chain delays the sound by, in frames: every device on it, switched on or off. */
function chainLatency(
  devices: Iterable<PlacedDevice>,
  sampleRate: number
): number {
  let frames = 0;
  for (const placed of devices) {
    frames += toFrames(placedLatency(placed, sampleRate), sampleRate);
  }
  return frames;
}

/**
 * Plays an arrangement on a context: a clip player for each audio track, an
 * instrument with a voice per held note for each MIDI track, each track's
 * device chain, and the mixer they all go through, on one transport counted
 * in frames of the audio clock. The document drives it through `update`; the
 * interface never touches it. Resolves once the clip player is loaded into
 * the context; `null` when the context cannot run worklets.
 */
export async function createArrangementEngine(
  ctx: BaseAudioContext,
  {
    destination = ctx.destination,
    library = libraryDevice,
    voices = VOICES,
  }: ArrangementEngineOptions = {}
): Promise<ArrangementEngine | null> {
  if (!(await loadClipPlayer(ctx))) {
    return null;
  }
  const rate = ctx.sampleRate;
  const mixer = createMixer(ctx, destination);
  const runtimes = new Map<string, TrackRuntime>();
  let doc: ArrangementDoc | null = null;
  let overrides: Readonly<Record<string, readonly AutomatedParameter[]>> = {};
  let state: PlaybackState = STOPPED;
  let scheduled = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let recordingsIn: ReadonlyMap<string, RecordingSource> = new Map();
  let metronome: MetronomeSettings = { on: false };
  let clicks: { accent: boolean; start: number }[] = [];
  let pendingClicks: { at: number; oscillator: OscillatorNode }[] = [];

  const now = () => Math.ceil(ctx.currentTime * rate);
  const deviceContext = (): DeviceContext | undefined =>
    doc ? { tempo: doc.tempo } : undefined;

  const runtimeOf = (id: string): TrackRuntime => {
    const existing = runtimes.get(id);
    if (existing) {
      return existing;
    }
    const made: TrackRuntime = {
      chainKey: "",
      clips: null,
      devices: new Map(),
      instrument: null,
      notes: [],
      played: [],
      player: null,
    };
    runtimes.set(id, made);
    return made;
  };

  const releaseVoices = (runtime: TrackRuntime, at: number) => {
    runtime.instrument?.player.release(at / rate);
  };

  const disposeRuntime = (id: string) => {
    const runtime = runtimes.get(id);
    if (!runtime) {
      return;
    }
    runtime.player?.dispose();
    runtime.instrument?.player.dispose();
    for (const placed of runtime.devices.values()) {
      placed.engine.dispose();
      placed.bypass?.disconnect();
    }
    runtimes.delete(id);
  };

  /** Lets go of the engines of the devices a track no longer has, and of its instrument when it has none. */
  const dropGone = (runtime: TrackRuntime, wanted: readonly TrackDevice[]) => {
    for (const [id, placed] of runtime.devices) {
      if (!wanted.some((device) => device.id === id && !device.instrument)) {
        placed.engine.dispose();
        placed.bypass?.disconnect();
        runtime.devices.delete(id);
      }
    }
    dropInstruments(runtime, wanted);
  };

  /** Lets go of a track's instrument when the track no longer plays through it. */
  const dropInstruments = (
    runtime: TrackRuntime,
    wanted: readonly TrackDevice[]
  ) => {
    const head = wanted.find((device) => device.instrument);
    if (runtime.instrument && runtime.instrument.device.id !== head?.id) {
      runtime.instrument.player.dispose();
      runtime.instrument = null;
    }
  };

  /** A track's instrument made for `device`, its sound into `input`: a rack's engine, or voices of the library's instrument. */
  const makeInstrument = (
    device: TrackDevice,
    input: AudioNode,
    recordings: ReadonlyMap<string, RecordingSource>
  ): TrackInstrument | null => {
    if (device.device === DRUM_RACK_DEVICE) {
      const player = createDrumRackEngine(ctx, library);
      player.output.connect(input);
      return { device, kind: "drums", player, recordings };
    }
    if (device.device === INSTRUMENT_RACK_DEVICE) {
      const player = createInstrumentRackEngine(ctx, library, voices);
      player.output.connect(input);
      return { device, kind: "layers", player, recordings };
    }
    const entry = library(device.device);
    if (entry?.device.kind !== "instrument") {
      return null;
    }
    const values = entry.device.sanitize(device.state) as AnyDeviceState;
    const player = createVoicePool(
      ctx,
      entry,
      values,
      deviceContext(),
      voices,
      input
    );
    return { device, kind: "voices", player, recordings };
  };

  /** A MIDI track's instrument: made the first time, then brought in step when its device or the recordings change. */
  const syncInstrument = (
    runtime: TrackRuntime,
    device: TrackDevice,
    input: AudioNode,
    recordings: ReadonlyMap<string, RecordingSource>
  ) => {
    let current = runtime.instrument;
    const fresh = !current;
    if (!current) {
      current = makeInstrument(device, input, recordings);
      runtime.instrument = current;
    }
    if (
      !current ||
      (!fresh && current.device === device && current.recordings === recordings)
    ) {
      return;
    }
    const context = deviceContext();
    if (current.kind === "drums") {
      current.player.update(
        device.rack ?? { chains: [], macros: [] },
        context,
        fresh || current.recordings !== recordings
          ? padRecordings(recordings)
          : undefined
      );
    } else if (current.kind === "layers") {
      current.player.update(device.rack ?? { chains: [], macros: [] }, context);
    } else if (fresh || current.device.state !== device.state) {
      current.player.update(
        current.player.entry.device.sanitize(device.state) as AnyDeviceState,
        context
      );
    }
    current.device = device;
    current.recordings = recordings;
  };

  /** An effect's engine, made the first time, then told each new state. */
  const syncEffect = (
    runtime: TrackRuntime,
    device: TrackDevice,
    entry: LibraryDevice
  ) => {
    const values = entry.device.sanitize(device.state) as AnyDeviceState;
    const placed = runtime.devices.get(device.id);
    if (placed?.entry === entry) {
      placed.device = device;
      if (placed.state !== device.state) {
        placed.state = device.state;
        (placed.engine as LibraryEngine).update(values, deviceContext());
      }
      return;
    }
    placed?.engine.dispose();
    runtime.devices.set(device.id, {
      bypass: null,
      device,
      engine: entry.create(ctx, values, deviceContext()),
      entry,
      state: device.state,
    });
  };

  /** A rack on a track's chain: made the first time, then brought in step whenever its description changes. */
  const syncRack = (runtime: TrackRuntime, device: TrackDevice, rack: Rack) => {
    const placed = runtime.devices.get(device.id);
    if (placed && placed.entry === null) {
      if (placed.device !== device) {
        placed.device = device;
        (placed.engine as RackEngine).update(rack, deviceContext());
      }
      return;
    }
    placed?.engine.dispose();
    const engine = createRackEngine(ctx, library);
    engine.update(rack, deviceContext());
    runtime.devices.set(device.id, {
      bypass: null,
      device,
      engine,
      entry: null,
      state: device.state,
    });
  };

  /** What stands in for a device switched off: the sound goes by unchanged, as late as the device would make it. */
  const bypassOf = (placed: PlacedDevice): ChainLink => {
    const seconds = placedLatency(placed, rate);
    placed.bypass ??= ctx.createDelay(Math.max(1, seconds * 2));
    placed.bypass.delayTime.value = toFrames(seconds, rate) / rate;
    return { input: placed.bypass, output: placed.bypass };
  };

  /** Wires a track's effects in series again, only when they or their switches changed. */
  const rewire = (
    runtime: TrackRuntime,
    effects: readonly TrackDevice[],
    strip: MixerStrip
  ) => {
    const key = effects
      .map((device) => `${device.id}:${device.on === false ? "off" : "on"}`)
      .join(",");
    if (key === runtime.chainKey) {
      return;
    }
    runtime.chainKey = key;
    strip.setChain(
      effects.map((device) => {
        const placed = runtime.devices.get(device.id) as PlacedDevice;
        return device.on === false
          ? bypassOf(placed)
          : (placed.engine as ChainLink);
      })
    );
  };

  /** Brings a track's devices in step: engines made, updated or let go, its instrument, then its chain. */
  const syncDevices = (
    track: ArrangementTrack,
    runtime: TrackRuntime,
    recordings: ReadonlyMap<string, RecordingSource>
  ) => {
    const strip = mixer.strip(track.id) ?? mixer.main;
    const wanted = (track.devices ?? []).filter(
      (device) => device.rack || library(device.device)
    );
    dropGone(runtime, wanted);
    for (const device of wanted) {
      if (device.instrument) {
        syncInstrument(runtime, device, strip.input, recordings);
      } else if (device.rack) {
        syncRack(runtime, device, device.rack);
      } else {
        syncEffect(runtime, device, library(device.device) as LibraryDevice);
      }
    }
    rewire(
      runtime,
      wanted.filter((device) => !device.instrument),
      strip
    );
  };

  /** What the mixer is told: each track's mix (its automation where it has some), sends and chain latency. */
  const mixerState = (current: ArrangementDoc): MixerState => {
    const at = position();
    const levels = (track: ArrangementTrack) =>
      mixAt(track, mixOf(track), at / current.duration, overrides[track.id]);
    const strip = (track: ArrangementTrack) => {
      const mix = mixOf(track);
      const { gain, pan } = levels(track);
      return {
        gain,
        id: track.id,
        latency: trackLatency(runtimeOf(track.id)),
        on: !mix.muted,
        pan,
        soloed: mix.soloed,
      };
    };
    const main = mixOf(current.main);
    return {
      main: { gain: main.gain, pan: main.pan },
      returns: current.returns.map((track) => ({
        ...strip(track),
        pre: Boolean(track.pre),
      })),
      tracks: current.tracks.map((track) => ({
        ...strip(track),
        group: track.group ?? null,
        sends: track.sends ?? {},
      })),
    };
  };

  /** The frames a track's chain delays its sound by: its instrument, then its effects. */
  const trackLatency = (runtime: TrackRuntime) =>
    chainLatency(runtime.devices.values(), rate) +
    toFrames(instrumentLatency(runtime.instrument), rate);

  const position = () => {
    if (!state.playing) {
      return state.position / rate;
    }
    const output = (
      ctx as { getOutputTimestamp?: () => AudioTimestamp }
    ).getOutputTimestamp?.();
    const heard =
      output?.contextTime !== undefined && output.contextTime > 0
        ? output.contextTime +
          (performance.now() - (output.performanceTime ?? performance.now())) /
            1000
        : ctx.currentTime -
          ((ctx as AudioContext).outputLatency ?? 0) -
          ((ctx as AudioContext).baseLatency ?? 0);
    const frame = heardFrame(heard, rate, mixer.latency);
    return frame < state.at
      ? state.position / rate
      : arrangementFrame(state, frame) / rate;
  };

  /** The notes a MIDI track ends inside the loop, so none is held past the loop's last frame. */
  const endOf = (note: FrameNote) => {
    const { loop } = state;
    return loop && note.start < loop[1]
      ? Math.min(note.end, loop[1] - 1)
      : note.end;
  };

  const noteOn = (
    runtime: TrackRuntime,
    note: FrameNote,
    at: number,
    passId: string,
    parameters?: Readonly<Record<string, number>>
  ) => {
    const { chance, deviation, velocity } = note.note;
    if (!runtime.instrument || Math.random() >= (chance ?? 1)) {
      return;
    }
    const level = Math.min(
      1,
      Math.max(0, (velocity ?? 1) + Math.random() * (deviation ?? 0))
    );
    runtime.instrument.player.noteOn(
      { parameters, pitch: note.pitch, velocity: level },
      at / rate,
      passId
    );
  };

  const noteOff = (runtime: TrackRuntime, at: number, passId: string) =>
    runtime.instrument?.player.noteOff(at / rate, passId);

  /** The id of a note on one pass: a looped arrangement plays the same note again on the next. */
  const passOf = (note: FrameNote, startAt: number) => `${note.id}#${startAt}`;
  /** The pass a note that ends at the clock's frame `at` started on. */
  const passEnding = (note: FrameNote, at: number) =>
    `${note.id}#${at - (endOf(note) - note.start)}`;

  /** The note ons and offs of a track that fall in a block of the clock: a note that ends where another starts lets go first. */
  const scheduleNotes = (
    track: ArrangementTrack,
    from: number,
    count: number
  ) => {
    const runtime = runtimes.get(track.id);
    if (!runtime?.instrument || runtime.notes.length === 0) {
      return;
    }
    const ends = startsInWindow(state, from, count, runtime.notes, endOf);
    const starts = startsInWindow(
      state,
      from,
      count,
      runtime.notes,
      (note) => note.start
    );
    const events = [
      ...ends.map((event) => ({ ...event, off: true })),
      ...starts.map((event) => ({ ...event, off: false })),
    ].sort((a, b) => a.at - b.at || Number(b.off) - Number(a.off));
    for (const { at, item, off } of events) {
      if (off) {
        noteOff(runtime, at, passEnding(item, at));
      } else {
        noteOn(runtime, item, at, passOf(item, at));
      }
    }
  };

  /** A track's volume and pan glide to where its automation has them at the clock's frame `to`. */
  const scheduleAutomation = (track: ArrangementTrack, to: number) => {
    if (
      !(doc && track.automation && Object.keys(track.automation).length > 0)
    ) {
      return;
    }
    const at = arrangementFrame(state, to) / rate;
    mixer.glide(
      track.id,
      mixAt(track, mixOf(track), at / doc.duration, overrides[track.id]),
      to / rate
    );
  };

  /** The metronome's clicks in frames of the arrangement, on the bars of the signatures in force. */
  const readClicks = () => {
    clicks =
      doc && metronome.on
        ? metronomeClicks(
            doc.tempo,
            doc.signatures,
            doc.duration,
            metronome.rhythm
          ).map(({ accent, at }) => ({ accent, start: toFrames(at, rate) }))
        : [];
  };

  /** Takes back the clicks still ahead; one already sounding rings out. */
  const cancelClicks = () => {
    const at = now();
    for (const click of pendingClicks) {
      if (click.at > at) {
        click.oscillator.disconnect();
      }
    }
    pendingClicks = [];
  };

  /** The clicks of a stretch of the clock, as late as delay compensation makes what they count. */
  const scheduleClicks = (from: number, to: number) => {
    const past = now();
    pendingClicks = pendingClicks.filter((click) => click.at > past);
    const starts = startsInWindow(
      state,
      from,
      to - from,
      clicks,
      (click) => click.start
    );
    for (const { at, item } of starts) {
      const heard = at + mixer.latency;
      pendingClicks.push({
        at: heard,
        oscillator: triggerClick(destination, heard / rate, item.accent),
      });
    }
  };

  const schedule = (from: number, to: number) => {
    if (!(doc && state.playing) || to <= from) {
      return;
    }
    scheduleClicks(from, to);
    for (const track of doc.tracks) {
      scheduleNotes(track, from, to - from);
      scheduleAutomation(track, to);
    }
  };

  const broadcast = (next: PlaybackState) => {
    state = next;
    for (const runtime of runtimes.values()) {
      runtime.player?.schedule(next);
    }
  };

  /** The clock's frame the arrangement's end plays at, or none while the loop keeps it from coming. */
  const endFrame = () => {
    if (!doc) {
      return Number.POSITIVE_INFINITY;
    }
    const end = toFrames(doc.duration, rate);
    const { loop } = state;
    if (loop && state.position < loop[1]) {
      return Number.POSITIVE_INFINITY;
    }
    return state.at + Math.max(0, end - state.position);
  };

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (!state.playing) {
      return;
    }
    cancelClicks();
    const at = now();
    const stoppedAt = arrangementFrame(state, at);
    for (const runtime of runtimes.values()) {
      releaseVoices(runtime, at);
    }
    broadcast({ at, loop: state.loop, playing: false, position: stoppedAt });
  };

  /** Chase: a note already sounding where playback starts plays from there; a drum hit already struck is not struck again. */
  const chase = (at: number) => {
    for (const track of doc?.tracks ?? []) {
      const runtime = runtimes.get(track.id);
      const sustains =
        runtime?.instrument && runtime.instrument.kind !== "drums";
      for (const note of sustains ? runtime.notes : []) {
        if (note.start < state.position && endOf(note) > state.position) {
          noteOn(
            runtime as TrackRuntime,
            note,
            at,
            passOf(note, at - (state.position - note.start))
          );
        }
      }
    }
  };

  /**
   * The pages of streamed recordings the tracks read over `count` frames of
   * the clock from `from` under `playback`: those of the next half second of
   * every track first, then the rest, so no track waits behind another's.
   */
  const pagesOf = (playback: PlaybackState, from: number, count: number) => {
    const near = Math.min(count, toFrames(PAGES_FIRST_SECONDS, rate));
    const plan = (length: number) =>
      [...runtimes.values()].flatMap((runtime) =>
        runtime.played.length > 0
          ? pagesAhead(
              playback,
              runtime.played,
              from,
              length,
              streamedRecording,
              rate,
              PAGE_FRAMES
            )
          : []
      );
    const first: PageRequest[] = plan(near);
    return near < count ? [...first, ...plan(count)] : first;
  };

  /** Asks for the pages of the next seconds of playback, or of a play from where it stopped. */
  const prefetch = () =>
    wantPages(pagesOf(state, now(), toFrames(PAGES_AHEAD_SECONDS, rate)));

  /** The scheduler of a running context: it wakes often and schedules what the next moments hold, and stops at the end. */
  const startClock = () => {
    let ticks = 0;
    const tick = () => {
      const until = now() + toFrames(LOOKAHEAD_SECONDS, rate);
      schedule(scheduled, until);
      scheduled = Math.max(scheduled, until);
      if (ticks % PREFETCH_TICKS === 0) {
        prefetch();
      }
      ticks += 1;
      if (now() >= endFrame()) {
        stop();
      }
    };
    if (timer !== null) {
      clearInterval(timer);
    }
    timer = setInterval(tick, POLL_MS);
    tick();
  };

  const play = (from: number, at = now() + toFrames(START_SECONDS, rate)) => {
    if (!doc) {
      return;
    }
    cancelClicks();
    for (const runtime of runtimes.values()) {
      releaseVoices(runtime, at);
    }
    broadcast({
      at,
      loop: loopOf(doc, rate),
      playing: true,
      position: Math.max(0, toFrames(from, rate)),
    });
    prefetch();
    chase(at);
    scheduled = at;
    if (!(ctx instanceof OfflineAudioContext)) {
      startClock();
    }
  };

  /** A track's clip player, made the first time, then given its clips when they or the recordings changed. */
  const syncPlayer = (
    track: ArrangementTrack,
    runtime: TrackRuntime,
    next: ArrangementDoc,
    recordings: ReadonlyMap<string, RecordingSource>
  ) => {
    const strip = mixer.strip(track.id);
    if (!runtime.player && strip) {
      runtime.player = createClipPlayer(ctx);
      runtime.player.output.connect(strip.input);
      runtime.player.schedule(state);
    }
    const clips = next.clips.filter(
      (clip) => clip.track === track.id && !clip.notes
    );
    const same =
      recordings === recordingsIn &&
      runtime.clips?.length === clips.length &&
      clips.every((clip, index) => clip === runtime.clips?.[index]);
    if (runtime.player && !same) {
      runtime.clips = clips;
      runtime.played = playedClips(clips, (clip) => clip.recording, rate);
      runtime.player.setClips(runtime.played, recordings);
    }
  };

  /** A track's devices, and what it plays: the clips of an audio track, the notes of a MIDI one. */
  const syncTrack = (
    track: ArrangementTrack,
    next: ArrangementDoc,
    recordings: ReadonlyMap<string, RecordingSource>
  ) => {
    const runtime = runtimeOf(track.id);
    syncDevices(track, runtime, recordings);
    if (!next.tracks.includes(track)) {
      return;
    }
    if ((track.kind ?? "audio") === "audio") {
      syncPlayer(track, runtime, next, recordings);
    } else if (track.kind === "midi") {
      runtime.notes = framesOf(
        next.clips.filter((clip) => clip.track === track.id),
        rate
      );
    }
  };

  /**
   * While playing, a change of tempo scales every time of the document, so
   * the transport carries on from the same bar and beat (TRN-012), the notes
   * held let go and the ones sounding there start again; a new loop carries
   * on from where the playhead is.
   */
  const carryOn = (previous: ArrangementDoc | null, next: ArrangementDoc) => {
    if (!(previous && state.playing)) {
      return;
    }
    const at = now() + toFrames(START_SECONDS, rate);
    const ratio = secondsPerBar(next.tempo) / secondsPerBar(previous.tempo);
    if (ratio !== 1 && Number.isFinite(ratio) && ratio > 0) {
      cancelClicks();
      for (const runtime of runtimes.values()) {
        releaseVoices(runtime, at);
      }
      broadcast({ ...rescaled(state, ratio, at), loop: loopOf(next, rate) });
      chase(at);
      scheduled = at;
    } else if (!sameLoop(previous.loop, next.loop)) {
      broadcast({
        at,
        loop: loopOf(next, rate),
        playing: true,
        position: arrangementFrame(state, at),
      });
    }
  };

  /** A note started by hand: a voice of the track's instrument, now, as long as it is held. */
  const audition = (track: string, pitch: number, velocity: number) => {
    const runtime = runtimes.get(track);
    if (!runtime?.instrument) {
      return;
    }
    const at = now();
    const id = `hand-${pitch}`;
    noteOn(
      runtime,
      {
        end: at + 1,
        id,
        note: { id, length: 0, pitch, start: 0, velocity },
        pitch,
        start: 0,
      },
      at,
      id
    );
  };

  /** The note a panel's pad holds: one voice, which follows the pad as it moves. */
  const holdNote: ArrangementEngine["holdNote"] = (track, parameters) => {
    const runtime = runtimes.get(track);
    if (!runtime) {
      return;
    }
    const at = now();
    if (!parameters) {
      noteOff(runtime, at, PAD_NOTE);
      return;
    }
    noteOn(
      runtime,
      {
        end: at + 1,
        id: PAD_NOTE,
        note: { id: PAD_NOTE, length: 0, pitch: 69, start: 0, velocity: 1 },
        pitch: 69,
        start: 0,
      },
      at,
      PAD_NOTE,
      parameters
    );
  };

  return {
    dispose: () => {
      stop();
      for (const id of [...runtimes.keys()]) {
        disposeRuntime(id);
      }
      mixer.dispose();
    },
    cue: (from) => {
      if (state.playing) {
        return Promise.resolve();
      }
      const at = now();
      return wantPages(
        pagesOf(
          {
            at,
            loop: state.loop,
            playing: false,
            position: toFrames(from, rate),
          },
          at,
          toFrames(PAGES_AHEAD_SECONDS, rate)
        )
      );
    },
    get latency() {
      return mixer.latency;
    },
    load: (from, to) => wantPages(pagesOf(state, from, to - from)),
    mixer,
    noteOff: (track, pitch) => {
      const runtime = runtimes.get(track);
      if (runtime) {
        noteOff(runtime, now(), `hand-${pitch}`);
      }
    },
    noteOn: (track, pitch, velocity = 1) => audition(track, pitch, velocity),
    holdNote,
    play,
    get playing() {
      return state.playing;
    },
    position,
    ready: async () => {
      await Promise.all([
        ...[...runtimes.values()].flatMap((runtime) => [
          runtime.player?.synced(),
          runtime.instrument?.player.ready(),
          ...[...runtime.devices.values()].map((placed) =>
            placed.entry
              ? (placed.engine as LibraryEngine).ready
              : (placed.engine as RackEngine).ready()
          ),
        ]),
      ]);
    },
    schedule,
    setMetronome: (settings) => {
      metronome = settings;
      readClicks();
      cancelClicks();
      if (state.playing) {
        // What the scheduler has already passed, from the moment it was asked.
        scheduleClicks(Math.max(now(), state.at), scheduled);
      }
    },
    stop,
    update: (next, recordings, overridden = {}) => {
      const previous = doc;
      doc = next;
      if (
        previous?.tempo !== next.tempo ||
        previous?.signatures !== next.signatures ||
        previous?.duration !== next.duration
      ) {
        readClicks();
      }
      overrides = overridden;
      const kept = new Set(allTracks(next).map((track) => track.id));
      for (const id of [...runtimes.keys()]) {
        if (!kept.has(id)) {
          disposeRuntime(id);
        }
      }
      // The mixer makes the channels first, so the tracks have somewhere to go.
      mixer.update(mixerState(next));
      for (const track of allTracks(next)) {
        syncTrack(track, next, recordings);
      }
      recordingsIn = recordings;
      // The latencies may have changed with the devices.
      mixer.update(mixerState(next));
      carryOn(previous, next);
    },
  };
}

export interface RenderOptions
  extends Omit<ArrangementEngineOptions, "destination"> {
  /** Where the render starts, in seconds of the arrangement. @default 0 */
  from?: number;
  /** How far it has got, from 0 to 1, about every second rendered. */
  onProgress?: (done: number) => void;
  /** @default 48000 */
  sampleRate?: number;
  /** Where it ends, in seconds of the arrangement: nothing past it is rendered. */
  to: number;
}

/**
 * Renders the arrangement's main output to a buffer, faster than real time,
 * through the same engine that plays it: the same frames come out. Notes and
 * automation are scheduled a second at a time, as the render reaches them.
 * `null` when the browser cannot run the clip player's worklet offline.
 */
export async function renderArrangement(
  doc: ArrangementDoc,
  recordings: ReadonlyMap<string, RecordingSource>,
  { from = 0, onProgress, sampleRate = 48_000, to, ...options }: RenderOptions
): Promise<AudioBuffer | null> {
  const frames = Math.max(1, Math.ceil((to - from) * sampleRate));
  const ctx = new OfflineAudioContext(2, frames, sampleRate);
  const engine = await createArrangementEngine(ctx, options);
  if (!engine) {
    return null;
  }
  engine.update(doc, recordings);
  await engine.ready();
  engine.play(from, 0);
  // A second at a time, on whole render quanta, which is where a render can stop.
  const step = 128 * Math.max(1, Math.round(sampleRate / 128));
  const ahead = toFrames(LOOKAHEAD_SECONDS, sampleRate);
  // The pages of streamed recordings each second reads are in before it is rendered.
  await engine.load(0, Math.min(frames, step + ahead));
  engine.schedule(0, Math.min(frames, step + ahead));
  for (let at = step; at < frames; at += step) {
    ctx.suspend(at / sampleRate).then(async () => {
      const until = Math.min(frames, at + step + ahead);
      await engine.load(at, until);
      engine.schedule(at + ahead, until);
      onProgress?.(at / frames);
      ctx.resume();
    });
  }
  const rendered = await ctx.startRendering();
  onProgress?.(1);
  engine.dispose();
  return rendered;
}