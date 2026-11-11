/**
 * What a block of 128 frames costs the renderer, per warp mode: `tracks`
 * tracks, each playing clips of one generated take back to back, 1.12 times
 * slower than recorded, for 30 s. Run it when the work is done, not on every
 * change: `bun --no-cache src/audio/playback/render.bench.ts tones 16 streamed`
 * (the mode, how many tracks, and `streamed` to read the take through a stream
 * as the app does). A render quantum has 2.67 ms at 48 kHz (PRF-008).
 */
import { playedClips, type WarpMode } from "./clip.ts";
import { type Recording, TrackRenderer } from "./render.ts";
import {
  createPagePool,
  createRecordingStream,
  PAGE_FRAMES,
  slotOffset,
} from "./stream.ts";

const RATE = 48_000;
const BLOCK = 128;
const QUANTUM_MS = (BLOCK / RATE) * 1000;
const TAKE_SECONDS = 10;

const [mode = "tones", tracks = "8", read = "decoded"] = process.argv.slice(2);

/** A chord that swells and fades, with a little noise, as the load sets play. */
const take = (channel: number) =>
  Float32Array.from({ length: RATE * TAKE_SECONDS }, (_, index) => {
    const time = index / RATE;
    const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * time);
    return (
      swell *
        0.15 *
        (Math.sin(2 * Math.PI * (220 + channel) * time) +
          Math.sin(2 * Math.PI * 277.18 * time) +
          Math.sin(2 * Math.PI * 329.63 * time)) +
      0.02 * (Math.random() * 2 - 1)
    );
  });

function streamedTake(data: Float32Array[]): Recording {
  const pool = createPagePool(64, { shared: false });
  const stream = createRecordingStream(pool, 2, RATE * TAKE_SECONDS);
  for (let page = 0; page < stream.directory.length; page += 1) {
    stream.directory[page] = page;
    for (const [channel, samples] of data.entries()) {
      pool.samples.set(
        samples.subarray(page * PAGE_FRAMES, (page + 1) * PAGE_FRAMES),
        slotOffset(pool, page, channel)
      );
    }
  }
  return { sampleRate: RATE, stream };
}

const channels = [take(0), take(1)];
const recordings = new Map<string, Recording>([
  [
    "take",
    read === "streamed"
      ? streamedTake(channels)
      : { channels, sampleRate: RATE },
  ],
]);

const renderers = Array.from({ length: Number(tracks) }, () => {
  const renderer = new TrackRenderer(RATE, recordings);
  const clips = Array.from({ length: 6 }, (_, index) => ({
    recording: "take",
    sourceLength: TAKE_SECONDS,
    value: {
      fadeIn: 0,
      fadeOut: 0,
      length: TAKE_SECONDS,
      offset: 0,
      start: index * TAKE_SECONDS,
    },
    warp: [
      { source: 0, target: 0 },
      { source: TAKE_SECONDS / 1.12, target: TAKE_SECONDS },
    ],
    warpMode: mode as WarpMode,
  }));
  renderer.setClips(playedClips(clips, (clip) => clip.recording, RATE));
  renderer.schedule({ at: 0, loop: null, playing: true, position: 0 });
  return renderer;
});

const output = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
const times: number[] = [];
for (let block = 0; block < (RATE * 30) / BLOCK; block += 1) {
  const started = performance.now();
  for (const renderer of renderers) {
    for (const channel of output) {
      channel.fill(0);
    }
    renderer.render(output, block * BLOCK, BLOCK);
  }
  times.push(performance.now() - started);
}

const sorted = [...times].sort((a, b) => a - b);
const at = (share: number) =>
  (sorted[Math.floor((sorted.length - 1) * share)] ?? 0).toFixed(3);
process.stdout.write(
  `${mode}, ${tracks} tracks, ${read}: median ${at(0.5)} ms, 99.9th ${at(0.999)} ms, worst ${at(1)} ms, ${times.filter((time) => time > QUANTUM_MS).length} of ${times.length} blocks over ${QUANTUM_MS.toFixed(2)} ms\n`
);
