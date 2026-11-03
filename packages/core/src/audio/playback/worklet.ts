/**
 * The clip player as it runs in an AudioWorklet: the processor around
 * `TrackRenderer`. It is not imported by the package: `bun run worklet:build`
 * bundles it into `CLIP_PLAYER_WORKLET`, the source a context loads with
 * `audioWorklet.addModule`.
 */
import { CLIP_PLAYER_PROCESSOR, type ClipPlayerMessage } from "./protocol.ts";
import { type Recording, TrackRenderer } from "./render.ts";

// The globals of an AudioWorkletGlobalScope, which no TypeScript library describes.
declare const currentFrame: number;
declare const sampleRate: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

/** One store for the scope, so every player of a context reads the same recordings. */
const recordings = new Map<string, Recording>();

class ClipPlayerProcessor extends AudioWorkletProcessor {
  private alive = true;
  private readonly renderer = new TrackRenderer(sampleRate, recordings);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<ClipPlayerMessage>) =>
      this.receive(event.data);
  }

  receive(message: ClipPlayerMessage) {
    switch (message.type) {
      case "recording":
        recordings.set(message.id, {
          channels: message.channels,
          sampleRate: message.sampleRate,
        });
        break;
      case "forget":
        recordings.delete(message.id);
        break;
      case "clips":
        this.renderer.setClips(message.clips);
        break;
      case "state":
        this.renderer.schedule(message.state);
        break;
      case "dispose":
        this.alive = false;
        break;
      default:
        break;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const [output] = outputs;
    if (output?.[0]) {
      this.renderer.render(output, currentFrame, output[0].length);
    }
    return this.alive;
  }
}

registerProcessor(CLIP_PLAYER_PROCESSOR, ClipPlayerProcessor);
