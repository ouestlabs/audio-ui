import { type PlaybackState, playedClip } from "@audio-ui/engine/playback";
import {
  createClipPlayer,
  loadClipPlayer,
} from "@/registry-audio/bases/base/lib/clip-player";
import { assert, check, firstDifference } from "./harness.ts";

const RATE = 48_000;

/** Half a second of a recording whose every sample differs. */
function recordingOn(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(2, RATE / 2, RATE);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      data[index] =
        0.5 * Math.sin(index * 0.013 + channel) * Math.cos(index * 1e-4);
    }
  }
  return buffer;
}

const playing = (loop: [number, number] | null = null): PlaybackState => ({
  at: 0,
  loop,
  playing: true,
  position: 0,
});

/** Renders one clip through the real AudioWorklet of an offline context. */
async function renderOffline(
  frames: number,
  clip: Parameters<typeof playedClip>[0],
  state: PlaybackState
) {
  const ctx = new OfflineAudioContext(2, frames, RATE);
  assert(await loadClipPlayer(ctx), "the context loads the clip player");
  const recording = recordingOn(ctx);
  const player = createClipPlayer(ctx);
  player.output.connect(ctx.destination);
  player.setClips(
    [playedClip(clip, "take", RATE)],
    new Map([["take", recording]])
  );
  player.schedule(state);
  await player.synced();
  const rendered = await ctx.startRendering();
  return { recording, rendered };
}

check("the page is cross-origin isolated, so recordings are shared", () => {
  assert(globalThis.crossOriginIsolated, "crossOriginIsolated is true");
});

check(
  "CLP-001: an offline render plays the recording bit-identical",
  async () => {
    const { recording, rendered } = await renderOffline(
      RATE,
      {
        sourceLength: 0.5,
        value: { fadeIn: 0, fadeOut: 0, length: 0.25, offset: 0.1, start: 0.2 },
      },
      playing()
    );
    for (let channel = 0; channel < 2; channel += 1) {
      const out = rendered.getChannelData(channel);
      const source = recording.getChannelData(channel);
      const at = firstDifference(
        out.subarray(0.2 * RATE, 0.45 * RATE),
        source.subarray(0.1 * RATE, 0.35 * RATE)
      );
      assert(
        at === -1,
        `channel ${channel} differs from the recording at frame ${at}`
      );
      assert(
        out[0.2 * RATE - 1] === 0 && out[0.45 * RATE] === 0,
        "silent around the clip"
      );
    }
  }
);

check("TRN-005: the loop wraps on the frame in a real worklet", async () => {
  // A loop of 1001 frames, which no render quantum divides.
  const { recording, rendered } = await renderOffline(
    8000,
    {
      sourceLength: 0.5,
      value: { fadeIn: 0, fadeOut: 0, length: 0.5, offset: 0, start: 0 },
    },
    playing([0, 1001])
  );
  const out = rendered.getChannelData(0);
  const source = recording.getChannelData(0);
  for (let index = 0; index < 8000; index += 1) {
    assert(
      out[index] === source[index % 1001],
      `frame ${index} reads ${out[index]}, not frame ${index % 1001} of the recording`
    );
  }
});

check("a player plays in a running AudioContext", async () => {
  const ctx = new AudioContext({ sampleRate: RATE });
  await ctx.resume();
  assert(await loadClipPlayer(ctx), "the context loads the clip player");
  const player = createClipPlayer(ctx);
  const analyser = ctx.createAnalyser();
  // An analyser only runs when the graph is pulled: through a silent gain to the output.
  const silent = ctx.createGain();
  silent.gain.value = 0;
  player.output.connect(analyser).connect(silent).connect(ctx.destination);
  const recording = recordingOn(ctx);
  player.setClips(
    [
      playedClip(
        {
          sourceLength: 0.5,
          value: { fadeIn: 0, fadeOut: 0, length: 0.5, offset: 0, start: 0 },
        },
        "take",
        RATE
      ),
    ],
    new Map([["take", recording]])
  );
  player.schedule({
    at: Math.ceil((ctx.currentTime + 0.02) * RATE),
    loop: null,
    playing: true,
    position: 0,
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  const samples = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(samples);
  const loudest = samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample)),
    0
  );
  player.dispose();
  await ctx.close();
  assert(loudest > 0.1, `the output is near silent (${loudest})`);
});
