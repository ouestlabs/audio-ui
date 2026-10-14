#!/usr/bin/env bun
/**
 * reset.ts, wipe all shadcn-installed files and restore the sandbox to a clean Next.js state.
 *
 * Usage:
 *   bun scripts/reset.ts
 *
 * Strategy: read components.json aliases to derive exactly what shadcn manages.
 * No hardcoded paths, safe to run without modification.
 */

import { $ } from "bun";

// URLs resolve the `..`, so this is a plain absolute path.
const root = Bun.fileURLToPath(new URL("..", import.meta.url)).slice(0, -1);

const config = await Bun.file(`${root}/components.json`).json();
const aliases: Record<string, string> = config.aliases ?? {};

const ALIAS_PREFIX = /^@\//;

// Resolve alias values to their top-level directories and deduplicate them.
// An alias that names no folder ("@/") would resolve to the sandbox itself:
// skip it rather than wipe everything.
const managed = new Set(
  Object.values(aliases)
    .map((alias) => alias.replace(ALIAS_PREFIX, "").split("/")[0])
    .filter((folder) => folder)
    .map((folder) => `${root}/${folder}`)
);

console.log("→ Removing shadcn-managed directories...");
await Promise.all([...managed].map((dir) => $`rm -rf ${dir}`.quiet()));
for (const dir of managed) {
  console.log(`  removed  ./${dir.replace(`${root}/`, "")}`);
}

console.log("→ Restoring app/page.tsx...");
await Bun.write(
  `${root}/app/page.tsx`,
  `export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Sandbox ready.</p>
    </div>
  );
}
`
);

console.log(`
✓ Sandbox reset to clean state.

  Install a component (it lands in ./components/audio-ui/):
  bunx shadcn add @audio-ui/knob
`);
