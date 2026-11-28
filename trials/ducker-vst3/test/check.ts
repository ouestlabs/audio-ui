// Checks a build: the compiled processor against the JavaScript it comes from,
// to the bit, then the bundle's sidechain and saved state through a small host.
// Run after `bun run build`.

import { $ } from "bun";

const root = `${import.meta.dir}/..`;
const dist = `${root}/dist`;
const native = `${root}/node_modules/@audio/plugin-vst/native`;
const wabt = (await $`brew --prefix wabt`.text()).trim();
const includes = [
  dist,
  native,
  `${wabt}/include`,
  `${wabt}/share/wabt/wasm2c`,
].map((path) => `-I${path}`);
const objects = [
  "atom",
  "dsp",
  "wasm-rt-impl",
  "wasm-rt-mem-impl",
  "wasm-rt-exceptions-impl",
].map((name) => `${dist}/${name}.o`);

await $`clang ${includes} -O2 -c ${import.meta.dir}/processor.c -o ${dist}/harness.o`;
await $`clang++ ${dist}/harness.o ${objects} -o ${dist}/harness`;
const raw = await $`${dist}/harness`.arrayBuffer();
const compiled = new Float32Array(raw);

const { duckerProcessor } = await import(`${dist}/processor.js`);
const params = Object.fromEntries(
  Object.entries(
    duckerProcessor.params as Record<string, { default: number | boolean }>
  ).map(([name, { default: value }]) => [
    name,
    typeof value === "boolean" ? value : Float32Array.of(value),
  ])
);
const run = duckerProcessor({
  maxBlockSize: 128,
  maxChannels: 2,
  params,
  sampleRate: 48_000,
});

// The signal of processor.c: a tone, a key every 250 ms, off for the third second.
let differing = 0;
for (let block = 0; block < 1500; block += 1) {
  const sound = new Float32Array(128);
  const key = new Float32Array(128);
  for (let frame = 0; frame < 128; frame += 1) {
    const at = block * 128 + frame;
    sound[frame] = 0.3 * Math.sin((2 * Math.PI * 440 * at) / 48_000);
    key[frame] =
      (at % 12_000 < 3000 ? 0.9 : 0) * (Math.floor(at / 24) % 2 ? 1 : -1);
  }
  const out = [new Float32Array(128), new Float32Array(128)];
  params.enabled = !(block >= 750 && block < 1125);
  run(
    [
      [sound, sound],
      [key, key],
    ],
    [out],
    params
  );
  differing += out[0].filter(
    (sample, frame) => sample !== compiled[block * 128 + frame]
  ).length;
}
if (compiled.length !== 192_000 || differing > 0) {
  throw new Error(
    `The compiled processor differs: ${compiled.length} samples, ${differing} unlike.`
  );
}
console.log("compiled processor: 192000 samples, all equal to JavaScript's");

await $`clang++ -std=c++17 -I${native} ${import.meta.dir}/host.cpp -o ${dist}/host`;
const binaries = `${dist}/audio-ui Ducker.vst3/Contents/MacOS`;
const [binary] = await Array.fromAsync(new Bun.Glob("*").scan(binaries));
await $`${dist}/host ${`${binaries}/${binary}`}`;
