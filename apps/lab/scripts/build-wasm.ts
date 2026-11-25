/**
 * Compiles each device's `audio/kernel.js` to `audio/kernel.wasm` with jz: the
 * same JavaScript file, as WebAssembly. `memory.fixed` makes jz prove that
 * `set` and `tick` never allocate, grow the memory or call the host, so they
 * are safe on the audio thread; a kernel that cannot be proved fails here.
 *
 *   bun run wasm:build
 */
import { compile } from "jz";

const DEVICES = `${import.meta.dir}/../src/components/devices`;

for await (const path of new Bun.Glob("*/audio/kernel.js").scan(DEVICES)) {
  const source = await Bun.file(`${DEVICES}/${path}`).text();
  const wasm = compile(source, { memory: { fixed: ["set", "tick"] } });
  const out = path.replace(".js", ".wasm");
  await Bun.write(`${DEVICES}/${out}`, wasm);
  console.log(`${out}: ${wasm.byteLength} bytes`);
}
