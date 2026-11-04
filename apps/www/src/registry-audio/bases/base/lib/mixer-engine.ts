import {
  delayCompensation,
  panGains,
  soloState,
} from "@audio-ui/core/playback";

/** How fast a control follows a change by hand, as a time constant: settled within 10 ms, with no zipper. */
const RAMP_SECONDS = 0.003;
/** The longest a path can wait for the others, in seconds. */
const MAX_COMPENSATION_SECONDS = 2;

/** What a channel does with its sound. */
export interface StripMix {
  /** Its volume, as a gain: 1 is unity. */
  gain: number;
  /** Its switch: off, it sends nothing on, and nothing through its post-fader sends. */
  on: boolean;
  /** From -1 (left) to 1 (right). */
  pan: number;
  soloed: boolean;
}

/** A track as the mixer plays it. */
export interface MixerTrack extends StripMix {
  id: string;
  /** The frames its device chain delays it. */
  latency: number;
  /** How much it sends to each return, by the return's id, as a gain. */
  sends: Readonly<Record<string, number>>;
}

/** A return track as the mixer plays it. */
export interface MixerReturn extends StripMix {
  id: string;
  /** The frames its device chain delays it. */
  latency: number;
  /** Whether it takes what is sent to it before the senders' volume, pan and switch. */
  pre: boolean;
}

export interface MixerState {
  main: { gain: number; pan?: number };
  returns: readonly MixerReturn[];
  /** Whether a soloed track keeps the returns heard. @default true */
  soloInPlace?: boolean;
  tracks: readonly MixerTrack[];
}

/** A device's sound path, as a chain links it. */
export interface ChainLink {
  readonly input: AudioNode;
  readonly output: AudioNode;
}

/** A channel of the mixer. */
export interface MixerStrip {
  /** Where its sound comes in: a clip player, an instrument. Stereo. */
  readonly input: AudioNode;
  /** One analyser per channel of what it sends on, after its volume, pan and switch: what a meter reads. */
  readonly meter: readonly AnalyserNode[];
  /** Puts these in series between its input and its volume, in order; with none, the sound goes straight on. */
  setChain: (chain: readonly ChainLink[]) => void;
}

export interface Mixer {
  dispose: () => void;
  /**
   * Moves a channel's volume and pan to where they are at `at` on the audio
   * clock, in a straight line from where they were: what automation plays.
   */
  glide: (id: string, mix: { gain: number; pan: number }, at: number) => void;
  /** How many frames late the whole mix comes out: what its delay compensation adds. */
  readonly latency: number;
  readonly main: MixerStrip;
  /** The channel of a track or a return, by id, once `update` has made it. */
  strip: (id: string) => MixerStrip | undefined;
  /** Makes, moves and removes the channels to match `state`. */
  update: (state: MixerState) => void;
}

interface Channel extends MixerStrip {
  /** The wait after the chain that lines it up with the slowest track. */
  compensation: DelayNode;
  /** The last value set on each param, so an update moves only what changed. */
  last: Map<AudioParam, number>;
  /** The wait on its way to the main track alone, that lines it up with the returns. */
  late: DelayNode;
  left: GainNode;
  nodes: AudioNode[];
  post: GainNode;
  pre: GainNode;
  right: GainNode;
  sends: Map<string, { from: GainNode; gain: GainNode }>;
  solo: GainNode;
  switch: GainNode;
  volume: GainNode;
}

/**
 * A mixer on the Web Audio API: a channel for each track and each return, and
 * the main track, which goes to `destination`.
 *
 * ```
 * input → chain → compensation → pre ─→ volume → pan → switch → post → late → solo → main
 *                                  └─ pre-fader sends     post-fader sends ─┘
 * ```
 *
 * The pan sets each channel on its own gain (`panGains`: 0 dB in the centre,
 * +3 dB at the side it is turned to); a solo silences the channels and sends
 * `soloState` says; delay compensation (`delayCompensation`) waits each path
 * so every one meets the main track on the same frame. A change by hand
 * glides within 10 ms. Nothing limits the main track: a mix over full scale
 * shows on the meters, as it would in the file.
 */
export function createMixer(
  ctx: BaseAudioContext,
  destination: AudioNode = ctx.destination
): Mixer {
  const channels = new Map<string, Channel>();
  let returnIds = new Set<string>();
  let latency = 0;

  const set = (target: Channel, param: AudioParam, value: number) => {
    if (target.last.get(param) !== value) {
      target.last.set(param, value);
      param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);
    }
  };
  const wait = (node: DelayNode, frames: number) => {
    const seconds = Math.min(MAX_COMPENSATION_SECONDS, frames / ctx.sampleRate);
    if (node.delayTime.value !== seconds) {
      node.delayTime.setValueAtTime(seconds, ctx.currentTime);
    }
  };

  /** A channel: its nodes made and wired, from its input to `to`. */
  const channel = (to: AudioNode): Channel => {
    const gain = () => ctx.createGain();
    const input = gain();
    input.channelCount = 2;
    input.channelCountMode = "explicit";
    const chainOut = gain();
    const compensation = ctx.createDelay(MAX_COMPENSATION_SECONDS);
    const pre = gain();
    const volume = gain();
    const splitter = ctx.createChannelSplitter(2);
    const left = gain();
    const right = gain();
    const merger = ctx.createChannelMerger(2);
    const toggle = gain();
    const post = gain();
    const late = ctx.createDelay(MAX_COMPENSATION_SECONDS);
    const solo = gain();
    const meterSplit = ctx.createChannelSplitter(2);
    const meter = [ctx.createAnalyser(), ctx.createAnalyser()];
    input.connect(chainOut);
    chainOut
      .connect(compensation)
      .connect(pre)
      .connect(volume)
      .connect(splitter);
    splitter.connect(left, 0).connect(merger, 0, 0);
    splitter.connect(right, 1).connect(merger, 0, 1);
    merger
      .connect(toggle)
      .connect(post)
      .connect(late)
      .connect(solo)
      .connect(to);
    post.connect(meterSplit);
    meterSplit.connect(meter[0] as AnalyserNode, 0);
    meterSplit.connect(meter[1] as AnalyserNode, 1);
    let links: readonly ChainLink[] = [];
    const nodes = [
      input,
      chainOut,
      compensation,
      pre,
      volume,
      splitter,
      left,
      right,
      merger,
      toggle,
      post,
      late,
      solo,
      meterSplit,
      ...meter,
    ];
    return {
      compensation,
      input,
      last: new Map(),
      late,
      left,
      meter,
      nodes,
      post,
      pre,
      right,
      sends: new Map(),
      setChain: (chain) => {
        // Undo the links made last time, and only those: a device's output may feed taps of its own.
        const before = [input, ...links.map((link) => link.output)];
        const after = [...links.map((link) => link.input), chainOut];
        for (const [index, from] of before.entries()) {
          from.disconnect(after[index] as AudioNode);
        }
        links = chain;
        const heads = [input, ...chain.map((link) => link.output)];
        const tails = [...chain.map((link) => link.input), chainOut];
        for (const [index, from] of heads.entries()) {
          from.connect(tails[index] as AudioNode);
        }
      },
      solo,
      switch: toggle,
      volume,
    };
  };

  const main = channel(destination);

  const remove = (id: string) => {
    const gone = channels.get(id);
    if (!gone) {
      return;
    }
    for (const node of gone.nodes) {
      node.disconnect();
    }
    for (const { gain } of gone.sends.values()) {
      gain.disconnect();
    }
    channels.delete(id);
  };

  const mix = (
    target: Channel,
    { gain, on, pan }: StripMix,
    heard: boolean
  ) => {
    const [left, right] = panGains(pan);
    set(target, target.volume.gain, Math.max(0, gain));
    set(target, target.left.gain, left);
    set(target, target.right.gain, right);
    set(target, target.switch.gain, on ? 1 : 0);
    set(target, target.solo.gain, heard ? 1 : 0);
  };

  /** The send from `target` to `back`, made or moved to the tap the return asks for. */
  const sendTo = (target: Channel, back: MixerReturn) => {
    const from = back.pre ? target.pre : target.post;
    const send = target.sends.get(back.id);
    if (send?.from === from) {
      return send;
    }
    let gain = send?.gain;
    if (send) {
      send.from.disconnect(send.gain);
      from.connect(send.gain);
    } else {
      gain = ctx.createGain();
      gain.gain.value = 0;
      from.connect(gain).connect((channels.get(back.id) as Channel).input);
    }
    const made = { from, gain: gain as GainNode };
    target.sends.set(back.id, made);
    return made;
  };

  /** A track's sends: one from the tap each return asks for, to its input, silenced where a solo says. */
  const routeSends = (
    target: Channel,
    track: MixerTrack,
    returns: readonly MixerReturn[],
    passes: (to: string) => boolean
  ) => {
    for (const [to, send] of target.sends) {
      if (!returnIds.has(to)) {
        send.gain.disconnect();
        target.sends.delete(to);
      }
    }
    for (const back of returns) {
      const send = sendTo(target, back);
      set(
        target,
        send.gain.gain,
        passes(back.id) ? Math.max(0, track.sends[back.id] ?? 0) : 0
      );
    }
  };

  /** Makes the channels `state` has that the mixer has not, and removes the ones it no longer has. */
  const match = (state: MixerState) => {
    const ids = new Set([
      ...state.tracks.map((track) => track.id),
      ...state.returns.map((track) => track.id),
    ]);
    for (const id of [...channels.keys()]) {
      if (!ids.has(id)) {
        remove(id);
      }
    }
    returnIds = new Set(state.returns.map((track) => track.id));
    for (const id of ids) {
      if (!channels.has(id)) {
        channels.set(id, channel(main.input));
      }
    }
  };

  return {
    dispose: () => {
      for (const id of [...channels.keys()]) {
        remove(id);
      }
      for (const node of main.nodes) {
        node.disconnect();
      }
    },
    glide: (id, { gain, pan }, at) => {
      const target = channels.get(id);
      if (!target) {
        return;
      }
      const [left, right] = panGains(pan);
      for (const [param, value] of [
        [target.volume.gain, Math.max(0, gain)],
        [target.left.gain, left],
        [target.right.gain, right],
      ] as const) {
        target.last.set(param, value);
        param.linearRampToValueAtTime(value, at);
      }
    },
    get latency() {
      return latency;
    },
    main,
    strip: (id) => channels.get(id),
    update: (state) => {
      match(state);
      const solo = soloState(
        [
          ...state.tracks.map((track) => ({
            ...track,
            kind: "track" as const,
          })),
          ...state.returns.map((track) => ({
            ...track,
            kind: "return" as const,
          })),
        ],
        { inPlace: state.soloInPlace ?? true }
      );
      const plan = delayCompensation(state.tracks, state.returns);
      latency = plan.total;
      for (const track of state.returns) {
        const target = channels.get(track.id) as Channel;
        mix(target, track, solo.heard(track.id));
        wait(target.compensation, plan.returns.get(track.id) ?? 0);
        wait(target.late, 0);
      }
      for (const track of state.tracks) {
        const target = channels.get(track.id) as Channel;
        mix(target, track, solo.heard(track.id));
        const waits = plan.tracks.get(track.id);
        wait(target.compensation, waits?.chain ?? 0);
        wait(target.late, waits?.main ?? 0);
        routeSends(target, track, state.returns, (to) =>
          solo.sends(track.id, to)
        );
      }
      const [left, right] = panGains(state.main.pan ?? 0);
      set(main, main.volume.gain, Math.max(0, state.main.gain));
      set(main, main.left.gain, left);
      set(main, main.right.gain, right);
    },
  };
}
