/**
 * The sound of Antares-1: a compressor, and a loop to squeeze. The loop goes
 * through an input trim, then the registry's compressor engine (the node, its
 * make-up, the dry and compressed mix), then an output level, into the bus the
 * unit is attached to. The panel's needle reads what the compressor is taking
 * off, and a VU reads what comes out.
 *
 * The controls speak in the panel's 0 to 10; `mapping.ts` turns each one into
 * the unit the engine takes. Everything moves with ramps, and stopping the loop
 * lets the compressor's release play out.
 */

import { createCompressorEngine } from "@/components/audio-ui/devices/compressor/engine";
import { DEFAULTS, inputDb, outputGain, type Panel, stateOf } from "./mapping";

export type Source = "Bass" | "Drums" | "Mix";
export const SOURCES: readonly Source[] = ["Drums", "Bass", "Mix"];

const SMOOTHING = 0.02;
/** How long after the loop stops the needle still reads the compressor, in seconds. */
const RELEASE_VIEW = 0.6;

export function createAntaresEngine(initial: Panel = DEFAULTS) {
  const panel = { ...initial };
  const buffers = new Map<Source, AudioBuffer>();
  let graph: {
    compressor: ReturnType<typeof createCompressorEngine>;
    ctx: BaseAudioContext;
    input: GainNode;
    output: GainNode;
    outputAnalyser: AnalyserNode;
  } | null = null;
  let playing: { fade: GainNode; source: AudioBufferSourceNode } | null = null;
  let current: Source = "Drums";
  /** When the loop last stopped, on the audio clock: the needle keeps its release for a moment after it. */
  let stoppedAt = Number.NEGATIVE_INFINITY;

  function fadeOut() {
    if (!(graph && playing)) {
      return;
    }
    const { fade, source } = playing;
    const now = graph.ctx.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + 0.02);
    source.stop(now + 0.05);
    source.onended = () => {
      source.disconnect();
      fade.disconnect();
    };
    playing = null;
    stoppedAt = now;
  }

  return {
    /** What the screen and the needle read: the analyser after the output, and how much the compressor takes off now, in dB. */
    meters: () =>
      graph
        ? {
            analyser: graph.outputAnalyser,
            // Out of the path, the node still measures, but nothing is taken off what is heard.
            reduction: () => {
              const live =
                playing !== null ||
                (graph?.ctx.currentTime ?? 0) - stoppedAt < RELEASE_VIEW;
              return panel.engaged && live
                ? (graph?.compressor.reduction ?? 0)
                : 0;
            },
          }
        : null,
    /** Builds the unit into `destination` (the bus): nothing sounds until the loop plays. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const compressor = createCompressorEngine(ctx, stateOf(panel));
      const input = ctx.createGain();
      input.gain.value = 10 ** (inputDb(panel.input) / 20);
      const output = ctx.createGain();
      output.gain.value = outputGain(panel.output);
      const outputAnalyser = ctx.createAnalyser();
      outputAnalyser.fftSize = 1024;
      input.connect(compressor.input);
      compressor.output.connect(output).connect(destination);
      output.connect(outputAnalyser);
      graph = { compressor, ctx, input, output, outputAnalyser };
    },
    /** Stops the loop and disconnects what this unit made; the shared context stays. */
    detach() {
      if (playing) {
        playing.source.stop();
        playing = null;
      }
      if (graph) {
        graph.compressor.dispose();
        graph.input.disconnect();
        graph.output.disconnect();
      }
      graph = null;
    },
    load(next: Partial<Record<Source, AudioBuffer>>) {
      for (const [name, buffer] of Object.entries(next)) {
        if (buffer) {
          buffers.set(name as Source, buffer);
        }
      }
    },
    play(source: Source = current) {
      const buffer = buffers.get(source);
      if (!(graph && buffer)) {
        return;
      }
      fadeOut();
      current = source;
      const loop = graph.ctx.createBufferSource();
      loop.buffer = buffer;
      loop.loop = true;
      const fade = graph.ctx.createGain();
      fade.gain.setValueAtTime(0, graph.ctx.currentTime);
      fade.gain.linearRampToValueAtTime(1, graph.ctx.currentTime + 0.02);
      loop.connect(fade).connect(graph.input);
      loop.start();
      playing = { fade, source: loop };
    },
    /** The panel changed: the compressor takes its new state, and the two levels follow. */
    set(next: Panel) {
      Object.assign(panel, next);
      if (!graph) {
        return;
      }
      graph.compressor.update(stateOf(panel));
      const now = graph.ctx.currentTime;
      graph.input.gain.setTargetAtTime(
        10 ** (inputDb(panel.input) / 20),
        now,
        SMOOTHING
      );
      graph.output.gain.setTargetAtTime(
        outputGain(panel.output),
        now,
        SMOOTHING
      );
    },
    stop() {
      fadeOut();
    },
  };
}

export type AntaresEngine = ReturnType<typeof createAntaresEngine>;
