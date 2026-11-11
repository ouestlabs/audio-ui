import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";
import type { RecordedBlock } from "@/registry-audio/bases/base/lib/recording";

const PROCESSOR = "audioui-input-recorder";

/**
 * The recorder's processor: while it records, it copies each block of its
 * input with the block's first frame on the audio clock and posts it out. It
 * has no output, so what it records is never heard through it.
 */
const WORKLET = `class InputRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.port.onmessage = (event) => {
      this.recording = event.data === "start";
      if (event.data === "stop") {
        this.port.postMessage({ stopped: true });
      }
    };
  }
  process(inputs) {
    const input = inputs[0];
    if (this.recording && input && input.length > 0) {
      const channels = input.map((channel) => channel.slice());
      this.port.postMessage(
        { channels, frame: currentFrame },
        channels.map((channel) => channel.buffer)
      );
    }
    return true;
  }
}
registerProcessor("${PROCESSOR}", InputRecorder);`;

/** An input recorder on a context, as `createInputRecorder` makes it. */
export interface InputRecorder {
  dispose: () => void;
  /** Connect what to record here, in stereo: a mono input is in both channels. It is only listened to, never heard. */
  readonly input: AudioNode;
  /** Keeps what comes in from the next block on. */
  start: () => void;
  /** Stops keeping, and gives every block kept since `start`, the last one in. */
  stop: () => Promise<RecordedBlock[]>;
}

/**
 * Records what is connected to it, block by block, each with its frame on the
 * audio clock: what `takeFrames` and `sliceBlocks` cut a take from (REC-007,
 * REC-008). `onBlock` hears each block as it comes, to draw the take live.
 * `null` when the context cannot run worklets.
 */
export async function createInputRecorder(
  ctx: BaseAudioContext,
  onBlock?: (block: RecordedBlock) => void
): Promise<InputRecorder | null> {
  if (!(await loadWorklet(ctx, WORKLET))) {
    return null;
  }
  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    channelCount: 2,
    channelCountMode: "explicit",
    numberOfInputs: 1,
    numberOfOutputs: 0,
  });
  let blocks: RecordedBlock[] = [];
  // While it stops: the one answer every `stop` gets, and what gives it.
  let stopping: Promise<RecordedBlock[]> | null = null;
  let settle: (() => void) | null = null;
  node.port.onmessage = (
    event: MessageEvent<RecordedBlock | { stopped: true }>
  ) => {
    if ("stopped" in event.data) {
      settle?.();
      return;
    }
    blocks.push(event.data);
    onBlock?.(event.data);
  };
  return {
    dispose: () => {
      settle?.();
      node.port.close();
      node.disconnect();
    },
    input: node,
    start: () => {
      blocks = [];
      stopping = null;
      node.port.postMessage("start");
    },
    stop: () => {
      stopping ??= new Promise((resolve) => {
        settle = () => {
          settle = null;
          resolve(blocks);
        };
        node.port.postMessage("stop");
      });
      return stopping;
    },
  };
}

/** How long a count-in click rings, in seconds. */
const CLICK_SECONDS = 0.03;

/**
 * Clicks a count-in on `ctx` from `at` seconds of its clock: `beats` beats
 * `beatSeconds` apart, the first of every `beatsPerBar` higher, straight to
 * the output (REC-005). The take starts on the beat after the last.
 */
export function playCountIn(
  ctx: BaseAudioContext,
  {
    at,
    beatSeconds,
    beats,
    beatsPerBar,
  }: { at: number; beatSeconds: number; beats: number; beatsPerBar: number }
): void {
  for (let beat = 0; beat < beats; beat += 1) {
    const time = at + beat * beatSeconds;
    const tone = ctx.createOscillator();
    const level = ctx.createGain();
    tone.frequency.value = beat % beatsPerBar === 0 ? 1600 : 1000;
    level.gain.setValueAtTime(0.3, time);
    level.gain.exponentialRampToValueAtTime(0.001, time + CLICK_SECONDS);
    tone.connect(level).connect(ctx.destination);
    tone.start(time);
    tone.stop(time + CLICK_SECONDS);
  }
}
