/**
 * sync-registry.ts
 *
 * Syncs upstream shadcn registry sources from a fresh shallow clone of
 * shadcn-ui/ui (`apps/v4/registry`) → `src/registry/` (shared primitives,
 * hooks, UI, styles). Audio catalog items (`block-*` / `*-demo` under
 * `registry-audio/bases/* /components`) are **not** copied from here, they
 * are ported from apps/www's registry, see plans/002.
 *
 * Usage (from apps/www):
 *   bun ./scripts/sync-registry.ts           # sync changed/new files, remove the ones upstream dropped
 *   bun ./scripts/sync-registry.ts --dry     # preview without writing
 *   bun run registry:sync                    # sync, then rebuild the icon barrels
 *
 * `bun run registry:sync -- --dry` is NOT a dry run: bun appends the flag to the
 * end of the script (the icons build), so the sync itself runs for real.
 */

import { $ } from "bun";

const DRY = Bun.argv.includes("--dry");
const VERBOSE = Bun.argv.includes("--verbose");

const PROJECT_ROOT = Bun.fileURLToPath(new URL("..", import.meta.url)).slice(
  0,
  -1
);
// The folder the log prints paths relative to: the one that holds apps/www.
const LOG_ROOT = PROJECT_ROOT.slice(0, PROJECT_ROOT.lastIndexOf("/"));
const DEST_DIR = `${PROJECT_ROOT}/src/registry`;

const SHADCN_UI_REMOTE = "https://github.com/shadcn-ui/ui.git";
const TRAILING_SLASH = /\/$/;

const SYNC_ITEMS = [
  "bases/base/hooks",
  "bases/base/lib",
  "bases/base/ui",
  "icons",
  "styles",
  "base-colors.ts",
  "bases.ts",
  "config.ts",
  "fonts.ts",
  "styles.tsx",
  "themes.ts",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Change = "added" | "deleted" | "skipped" | "unchanged" | "updated";

/** What happened to one file, by the path the log shows for it. */
interface Outcome {
  change: Change;
  label: string;
}

const SYMBOLS: Record<Exclude<Change, "skipped">, string> = {
  added: "+",
  deleted: "-",
  unchanged: "·",
  updated: "~",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `path` below `root`, as the log shows it. */
const relativeTo = (root: string, path: string) => path.slice(root.length + 1);

async function isDirectory(path: string): Promise<boolean> {
  return await Bun.file(path)
    .stat()
    .then(
      (stat) => stat.isDirectory(),
      () => false
    );
}

/** Every file under a folder, as paths relative to it, in a stable order. */
async function listFiles(dir: string): Promise<string[]> {
  const files = await Array.fromAsync(
    new Bun.Glob("**/*").scan({ cwd: dir, dot: true })
  );
  return files.sort();
}

async function sameBytes(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    Bun.file(a).bytes(),
    Bun.file(b).bytes(),
  ]);
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

/** Shallow, sparse clone of shadcn-ui/ui (apps/v4 only) into `dir`. */
async function cloneShadcnUi(dir: string) {
  console.log(`  Cloning ${SHADCN_UI_REMOTE} (apps/v4 only)...`);
  const clone = $`git clone --depth 1 --filter=blob:none --sparse ${SHADCN_UI_REMOTE} ${dir}`;
  await (VERBOSE ? clone : clone.quiet());
  const sparse = $`git -C ${dir} sparse-checkout set apps/v4`;
  await (VERBOSE ? sparse : sparse.quiet());
}

// ---------------------------------------------------------------------------
// Sync a single file src → dest
// ---------------------------------------------------------------------------

async function syncFile(src: string, dest: string): Promise<Change> {
  const exists = await Bun.file(dest).exists();
  if (exists && (await sameBytes(src, dest))) {
    return "unchanged";
  }
  if (!DRY) {
    await Bun.write(dest, Bun.file(src));
  }
  return exists ? "updated" : "added";
}

// ---------------------------------------------------------------------------
// Sync a directory src → dest (copy new/changed, remove orphaned dest files)
// ---------------------------------------------------------------------------

async function syncDirectory(
  srcDir: string,
  destDir: string,
  item: string
): Promise<Outcome[]> {
  // Forward pass: add / update
  const srcFiles = await listFiles(srcDir);
  const synced = await Promise.all(
    srcFiles.map(
      async (rel): Promise<Outcome> => ({
        change: await syncFile(`${srcDir}/${rel}`, `${destDir}/${rel}`),
        label: `${item}/${rel}`,
      })
    )
  );

  // Backward pass: remove orphaned files in dest
  const kept = new Set(srcFiles);
  const orphans = (await isDirectory(destDir))
    ? (await listFiles(destDir)).filter((rel) => !kept.has(rel))
    : [];
  const deleted = await Promise.all(
    orphans.map(async (rel): Promise<Outcome> => {
      if (!DRY) {
        await Bun.file(`${destDir}/${rel}`).delete();
      }
      return { change: "deleted", label: `${item}/${rel}` };
    })
  );

  return [...synced, ...deleted];
}

async function syncItem(sourceDir: string, item: string): Promise<Outcome[]> {
  const src = `${sourceDir}/${item}`;
  const stat = await Bun.file(src)
    .stat()
    .catch(() => null);
  if (!stat) {
    return [{ change: "skipped", label: item }];
  }

  const dest = `${DEST_DIR}/${item}`;
  if (stat.isDirectory()) {
    return await syncDirectory(src, dest, item);
  }
  return [{ change: await syncFile(src, dest), label: item }];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Prints what happened to each file, as the sync goes. */
function report(outcomes: Outcome[]) {
  for (const { change, label } of outcomes) {
    if (change === "skipped") {
      console.warn(`  ! ${label} (source not found, skipping)`);
    } else if (change !== "unchanged" || VERBOSE) {
      console.log(`  ${SYMBOLS[change]} ${label}`);
    }
  }
}

function printSummary(
  outcomes: Outcome[],
  srcLabel: string,
  destLabel: string
) {
  const totals: Record<Change, number> = {
    added: 0,
    deleted: 0,
    skipped: 0,
    unchanged: 0,
    updated: 0,
  };
  for (const { change } of outcomes) {
    totals[change] += 1;
  }
  const { added, deleted, skipped, unchanged, updated } = totals;

  console.log("\n──────────────────────────────────────────────");
  console.log(`  Sync complete: ${srcLabel} → ${destLabel} `);
  if (added + updated + deleted === 0 && skipped === 0) {
    console.log("  ✓ Everything is already up to date.");
  } else {
    if (added > 0) {
      console.log(`  + ${added} added`);
    }
    if (updated > 0) {
      console.log(`  ~ ${updated} updated`);
    }
    if (deleted > 0) {
      console.log(`  - ${deleted} deleted`);
    }
    if (unchanged > 0) {
      console.log(`  · ${unchanged} unchanged`);
    }
    if (skipped > 0) {
      console.log(`  ! ${skipped} skipped`);
    }
    if (DRY) {
      console.log("\n  (dry run, no files written)");
    }
  }
  console.log("──────────────────────────────────────────────\n");
}

async function sync() {
  const label = DRY ? "[DRY RUN] " : "";
  const srcLabel = "shadcn-ui/ui:apps/v4/registry";
  const destLabel = relativeTo(LOG_ROOT, DEST_DIR);

  const tmp = (process.env.TMPDIR ?? "/tmp").replace(TRAILING_SLASH, "");
  const cloneDir = `${tmp}/shadcn-ui-${crypto.randomUUID()}`;

  try {
    await cloneShadcnUi(cloneDir);
    const sourceDir = `${cloneDir}/apps/v4/registry`;

    console.log(`\n${label}Syncing registry: ${srcLabel} → ${destLabel}\n`);

    if (!(await isDirectory(sourceDir))) {
      console.error(`  Source not found: ${sourceDir}`);
      process.exitCode = 1;
      return;
    }

    if (!(await isDirectory(DEST_DIR))) {
      console.log(`  Created: ${DEST_DIR}`);
    }

    const items = (
      await Promise.all(SYNC_ITEMS.map((item) => syncItem(sourceDir, item)))
    ).flat();
    report(items);

    printSummary(items, srcLabel, destLabel);
  } finally {
    await $`rm -rf ${cloneDir}`.quiet();
  }
}

try {
  await sync();
} catch (error) {
  console.error("Error syncing registry:", error);
  process.exit(1);
}
