#!/usr/bin/env bun
/**
 * reset.ts — wipe all shadcn-installed files and restore the sandbox to a clean Next.js state.
 *
 * Usage:
 *   bun scripts/reset.ts
 *
 * Strategy: read components.json aliases to derive exactly what shadcn manages.
 * No hardcoded paths — safe to run without modification.
 */

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL(".", import.meta.url).pathname, "..");

const config = JSON.parse(
  readFileSync(resolve(root, "components.json"), "utf-8")
);
const aliases: Record<string, string> = config.aliases ?? {};

const ALIAS_PREFIX = /^@\//;

// Resolve alias values to absolute paths and deduplicate top-level dirs
const managed = new Set(
  Object.values(aliases).map((alias) => {
    const rel = alias.replace(ALIAS_PREFIX, "");
    return resolve(root, rel.split("/")[0]);
  })
);

console.log("→ Removing shadcn-managed directories...");
for (const dir of managed) {
  rmSync(dir, { force: true, recursive: true });
  console.log(`  removed  ./${dir.replace(`${root}/`, "")}`);
}

console.log("→ Restoring app/page.tsx...");
writeFileSync(
  resolve(root, "app/page.tsx"),
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

  Install a component:
  bunx shadcn add @audio/player
`);
