// How long a clip's waveform takes to read: run with `bun test/registry-audio/base/lib/clip-waveform.bench.ts`.
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import { clipWaveform } from "@/registry-audio/bases/base/lib/arrangement";

const SECONDS = 240;
const COLUMNS = 2304;
const peaks = Float32Array.from({ length: SECONDS * 256 }, (_, index) =>
  Math.abs(Math.sin(index / 37))
);
const clip: Arranged = {
  id: "a",
  name: "a",
  sourceLength: SECONDS,
  track: "t",
  value: { fadeIn: 0, fadeOut: 0, length: SECONDS, offset: 0, start: 0 },
};
const measure = (label: string, read: () => unknown) => {
  const rounds = 200;
  const start = performance.now();
  for (let round = 0; round < rounds; round += 1) {
    read();
  }
  console.log(
    `${label}: ${((performance.now() - start) / rounds).toFixed(3)} ms`
  );
};
measure("4 minutes, all in view", () => clipWaveform(clip, peaks, COLUMNS));
measure("4 minutes, 10 s in view", () =>
  clipWaveform(clip, peaks, COLUMNS, [100, 110])
);
const hour = Float32Array.from({ length: 2 ** 20 }, (_, index) =>
  Math.abs(Math.sin(index / 37))
);
const long: Arranged = {
  ...clip,
  sourceLength: 4096,
  value: { ...clip.value, length: 4096 },
};
measure("an hour, all in view", () => clipWaveform(long, hour, COLUMNS));
