// Builds the registry's Ducker as a VST3 on macOS. The processor is the one the
// web engine plays (`DUCKER_PROCESSOR` in the Ducker's device.ts): it is read
// from there and written out as a module, so there is one version of it.

import { chmod, mkdir, rm, symlink } from "node:fs/promises";
import { ducker } from "@audio/dynamics-ducker/audio";
import { toVst3 } from "@audio/plugin-vst";
import { $ } from "bun";
import { DUCKER_PROCESSOR } from "../../apps/www/src/registry/bases/shared/devices/ducker/device";

const dist = `${import.meta.dir}/dist`;
const tools = `${dist}/tools`;

if (process.platform !== "darwin") {
  throw new Error("This trial builds on macOS only.");
}
const wabt = (await $`brew --prefix wabt`.text()).trim();

await rm(dist, { force: true, recursive: true });
await mkdir(`${tools}/wabt/bin`, { recursive: true });

/** A command of ours in front of a tool's, to change the arguments it gets. */
async function wrap(path: string, script: string) {
  await Bun.write(path, `#!/bin/bash\n${script}\n`);
  await chmod(path, 0o755);
}

// wabt 1.0.42 reads exceptions by default and refuses the flag plugin-vst 0.0.2 passes.
await wrap(
  `${tools}/wabt/bin/wasm2c`,
  `args=()
for a in "$@"; do [ "$a" = --enable-exceptions ] || args+=("$a"); done
exec "${wabt}/bin/wasm2c" "\${args[@]}"`
);
await symlink(`${wabt}/include`, `${tools}/wabt/include`);
await symlink(`${wabt}/share`, `${tools}/wabt/share`);
// plugin-vst builds for this machine only: a host that runs under Rosetta needs x86_64 too.
await Promise.all(
  ["clang", "clang++"].map((compiler) =>
    wrap(
      `${tools}/${compiler}`,
      `exec /usr/bin/${compiler} -arch arm64 -arch x86_64 "$@"`
    )
  )
);
process.env.PATH = `${tools}:${process.env.PATH}`;

const module = `${dist}/processor.js`;
await Bun.write(
  module,
  `import { ducker } from "@audio/dynamics-ducker/audio";\n${DUCKER_PROCESSOR}\nexport { duckerProcessor };\n`
);
const { duckerProcessor } = await import(module);

// The identity a plugin is known by. Once a project holds it, it must not change.
Object.assign(duckerProcessor, {
  channels: ducker.channels,
  id: "ducker",
  title: "audio-ui Ducker",
  vendor: "dev.audio-ui",
});

const { bundle, realtime } = await toVst3(duckerProcessor).build({
  atom: module,
  out: dist,
  wabt: `${tools}/wabt`,
});
console.log(bundle);
console.log(realtime);
