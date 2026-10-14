#!/usr/bin/env bun
/**
 * Writes one barrel of icons per icon library (`src/registry/icons/__lucide__.ts`
 * and the rest) from the icons the registry uses: the `<IconPlaceholder>`
 * usages in the shadcn bases and in the audio catalog and elements under
 * `registry-audio/bases/base`, the icon arrays in `src/app`, and the Lucide
 * icons `scan-icons.ts` reported as unmapped.
 *
 * Run: bun run icons:build [--watch]
 */
import { type IconLibraryName, iconLibraries } from "shadcn/icons";

type IconUsage = Record<IconLibraryName, Set<string>>;
type IconLibrary = (typeof iconLibraries)[IconLibraryName];

const PROJECT_ROOT = Bun.fileURLToPath(new URL("..", import.meta.url)).slice(
  0,
  -1
);
const ICONS_DIR = `${PROJECT_ROOT}/src/registry/icons`;
const UNMAPPED_FILE = `${ICONS_DIR}/unmapped-icons.json`;

// Where `<IconPlaceholder>` is used. Only the `base` base is scanned.
const PLACEHOLDER_DIRS = [
  "src/registry/bases",
  "src/registry-audio/bases/base/components",
  "src/registry-audio/bases/base/audio",
].map((dir) => `${PROJECT_ROOT}/${dir}`);
// Where plain icon arrays (`PREVIEW_ICONS`) live.
const APP_DIR = `${PROJECT_ROOT}/src/app`;

const LIBRARIES = Object.entries(iconLibraries) as [
  IconLibraryName,
  IconLibrary,
][];

// A `<IconPlaceholder ... />` tag that sets at least one library's icon.
const ICON_PLACEHOLDER = new RegExp(
  `<IconPlaceholder\\s+([^>]*?)(?:${LIBRARIES.map(([, library]) => library.name).join("|")})=["']([^"']+)["']([^>]*?)\\/?>`,
  "g"
);
// The icon a tag names for each library.
const PLACEHOLDER_ICON = LIBRARIES.map(
  ([key, library]) =>
    [key, new RegExp(`${library.name}=["']([^"']+)["']`)] as const
);
// `lucide: ["Check", "X"]` in the app's preview lists, and the names inside.
const ICON_ARRAY = LIBRARIES.map(
  ([key, library]) =>
    [key, new RegExp(`\\b${library.name}:\\s*\\[([\\s\\S]*?)\\]`, "g")] as const
);
const QUOTED_NAME = /["']([A-Za-z][A-Za-z0-9_]*)["']/g;
const ICON_SUFFIX = /Icon$/;
// Dotfiles and dot folders.
const IGNORED_PATH = /(^|[/\\])\../;

async function isDirectory(path: string): Promise<boolean> {
  return await Bun.file(path)
    .stat()
    .then(
      (stat) => stat.isDirectory(),
      () => false
    );
}

/** The text of every `.tsx` file under the folders that exist. */
async function readSources(dirs: string[]): Promise<string[]> {
  const found = await Promise.all(
    dirs.map(async (dir) =>
      (await isDirectory(dir))
        ? await Array.fromAsync(
            new Bun.Glob("**/*.tsx").scan({
              absolute: true,
              cwd: dir,
              dot: true,
            })
          )
        : []
    )
  );
  return await Promise.all(found.flat().map((file) => Bun.file(file).text()));
}

async function addUnmappedIcons(usage: IconUsage) {
  const file = Bun.file(UNMAPPED_FILE);
  if (!(await file.exists())) {
    return;
  }
  try {
    const unmapped: unknown = await file.json();
    if (Array.isArray(unmapped)) {
      for (const item of unmapped) {
        if (item.icon) {
          // Unmapped icons currently only support Lucide in scan-icons.ts
          usage.lucide.add(item.icon);
        }
      }
    }
  } catch (error) {
    console.error("Error reading unmapped-icons.json:", error);
  }
}

async function scanIconUsage(): Promise<IconUsage> {
  const usage = Object.fromEntries(
    LIBRARIES.map(([key]) => [key, new Set<string>()])
  ) as IconUsage;

  // 1. <IconPlaceholder> in the registry bases and the audio catalog
  for (const content of await readSources(PLACEHOLDER_DIRS)) {
    for (const [tag] of content.matchAll(ICON_PLACEHOLDER)) {
      for (const [key, pattern] of PLACEHOLDER_ICON) {
        const icon = tag.match(pattern)?.[1];
        if (icon) {
          usage[key].add(icon);
        }
      }
    }
  }

  // 2. Plain icon arrays (e.g. PREVIEW_ICONS) in the app
  for (const content of await readSources([APP_DIR])) {
    for (const [key, pattern] of ICON_ARRAY) {
      for (const [, list] of content.matchAll(pattern)) {
        for (const [, icon] of list.matchAll(QUOTED_NAME)) {
          usage[key].add(icon);
        }
      }
    }
  }

  // 3. Unmapped icons from scan-icons output
  await addUnmappedIcons(usage);

  return usage;
}

/** Writes a library's barrel, and returns the lines to print about it. */
async function generateLibrary(
  key: IconLibraryName,
  config: IconLibrary,
  used: Set<string>
): Promise<{ error?: string; summary?: string; warning?: string }> {
  let icons = [...used].sort();
  if (icons.length === 0) {
    return {};
  }

  let library: Record<string, unknown>;
  try {
    library = await import(config.export);
  } catch {
    return {
      error: `  - ${config.title}: Failed to load library "${config.export}"`,
    };
  }

  // Lucide exports an icon as `Foo` and as `FooIcon`: look for both.
  if (key === "lucide") {
    const variants = new Set(icons);
    for (const icon of icons) {
      variants.add(
        icon.endsWith("Icon") ? icon.replace(ICON_SUFFIX, "") : `${icon}Icon`
      );
    }
    icons = [...variants].sort();
  }

  // Validate that icons exist in the library
  const valid = icons.filter((icon) => icon in library);
  const skipped = icons.filter((icon) => !(icon in library));
  const warning =
    skipped.length > 0
      ? `  - ${config.title}: Skipped ${skipped.length} non-existent icons: ${skipped.join(", ")}`
      : undefined;
  if (valid.length === 0) {
    return { warning };
  }

  await Bun.write(
    `${ICONS_DIR}/__${key}__.ts`,
    `// Auto-generated by scripts/build-icons.mts, do not edit manually
${valid.map((icon) => `export { ${icon} } from "${config.export}"`).join("\n")}
`
  );
  return { summary: `  - ${config.title}: ${valid.length} icons`, warning };
}

async function generateIconFiles(usage: IconUsage) {
  console.log("✓ Generating icon files:");

  const results = await Promise.all(
    LIBRARIES.map(([key, config]) => generateLibrary(key, config, usage[key]))
  );
  for (const { error, summary, warning } of results) {
    if (error) {
      console.error(error);
    }
    if (warning) {
      console.warn(warning);
    }
    if (summary) {
      console.log(summary);
    }
  }
}

async function main() {
  await generateIconFiles(await scanIconUsage());
}

async function watch() {
  const { default: chokidar } = await import("chokidar");

  await main();

  const candidates = [...PLACEHOLDER_DIRS, APP_DIR];
  const exist = await Promise.all(candidates.map(isDirectory));
  const dirs = candidates.filter((_, index) => exist[index]);

  const watcher = chokidar.watch(dirs, {
    ignored: IGNORED_PATH,
    ignoreInitial: true,
    persistent: true,
  });

  const rebuild = async (filename: string) => {
    if (!filename.endsWith(".tsx")) {
      return;
    }

    try {
      await main();
    } catch (error) {
      console.error("❌ Icons build failed:", error);
    }
  };

  watcher.on("error", (error) => {
    console.error("❌ Watcher error:", error);
  });

  watcher.on("change", rebuild);
  watcher.on("add", rebuild);

  process.on("SIGINT", async () => {
    await watcher.close();
    process.exit(0);
  });
}

if (Bun.argv.includes("--watch")) {
  await watch();
} else {
  await main();
}
