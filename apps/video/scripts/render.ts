/**
 * Films audio/ui:
 *
 *   bun run new <name>                        a new component: what it is, playing, and its install command
 *   bun run update <name> [--note "…"]…        an updated one: what changed (from --note, or the pending changesets)
 *   bun run showcase <name>                   one component as it is, with no status
 *   bun run all                               every component: "New" where the docs' menu marks it, no status otherwise
 *   bun run teaser                            the whole library
 *
 * Options: --theme light|dark.
 * The videos land in apps/video/out/.
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { SHOWCASES } from "../src/showcases/index.ts";
import { webpackOverride } from "../webpack-override.ts";

const root = path.resolve(import.meta.dir, "../../..");
const out = path.resolve(import.meta.dir, "../out");

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const SENTENCE_END = /(?<=[.!?])\s+/;
const QUOTED = /^(["'])(.*)\1$/;
const FINAL_PERIOD = /\.$/;
const MAX_NOTE_LENGTH = 90;
const MAX_NOTES = 3;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    note: { multiple: true, type: "string" },
    theme: { default: "light", type: "string" },
  },
});
const [command, name] = positionals;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** A `key: value` line of the docs page's frontmatter, unquoted. */
function frontmatterField(source: string, key: string) {
  const block = FRONTMATTER.exec(source)?.[1] ?? "";
  const line = block.split("\n").find((entry) => entry.startsWith(`${key}:`));
  return line
    ?.slice(key.length + 1)
    .trim()
    .replace(QUOTED, "$2");
}

/** Short sentences about `component` from the changesets waiting to be released. */
async function changesetNotes(component: string) {
  const directory = path.join(root, ".changeset");
  const files = (
    await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: directory }))
  ).filter((file) => file !== "README.md");
  const mentions = new RegExp(`\\b${component}\\b`, "i");
  const bodies = await Promise.all(
    files.map(async (file) =>
      (await Bun.file(path.join(directory, file)).text())
        .replace(FRONTMATTER, "")
        .replaceAll("`", "")
        .trim()
    )
  );
  const notes = bodies
    .filter((body) => mentions.test(body))
    .flatMap((body) => body.split(SENTENCE_END))
    .map((sentence) => sentence.trim().replace(FINAL_PERIOD, ""))
    .filter((note) => note && note.length <= MAX_NOTE_LENGTH);
  return notes.slice(0, MAX_NOTES);
}

async function spotlightProps(
  kind: "new" | "showcase" | "update",
  component: string
) {
  if (!SHOWCASES[component]) {
    fail(
      `No showcase for "${component}": add one to apps/video/src/showcases/ and list it in index.ts.\nKnown: ${Object.keys(SHOWCASES).join(", ")}`
    );
  }
  const page = Bun.file(
    path.join(
      root,
      `apps/www/src/content/docs/components/base/${component}.mdx`
    )
  );
  if (!(await page.exists())) {
    fail(
      `No docs page for "${component}" in apps/www/src/content/docs/components/base/.`
    );
  }
  const docs = await page.text();

  let notes = values.note ?? [];
  if (kind === "update" && notes.length === 0) {
    notes = await changesetNotes(component);
    if (notes.length === 0) {
      fail(
        `Nothing to say about "${component}": pass --note "…" (up to ${MAX_NOTES}), or add a changeset that mentions it.`
      );
    }
    console.log(
      `Notes from the pending changesets (override with --note):\n${notes.map((note) => `  + ${note}`).join("\n")}`
    );
  }
  return {
    description: frontmatterField(docs, "description") ?? "",
    kind,
    name: component,
    notes: notes.slice(0, MAX_NOTES),
    theme: values.theme === "dark" ? "dark" : "light",
    title:
      frontmatterField(docs, "title") ??
      SHOWCASES[component]?.title ??
      component,
  };
}

type Job = { file: string; id: string; props: Record<string, unknown> };
type Kind = "new" | "showcase" | "update";

const spotlight = async (kind: Kind, component: string): Promise<Job> => ({
  file: kind === "showcase" ? `${component}.mp4` : `${component}-${kind}.mp4`,
  id: "Spotlight",
  props: await spotlightProps(kind, component),
});

/** Every component with a showcase: "New component" where the docs' menu marks it new, no status otherwise. */
async function everyComponent(): Promise<Job[]> {
  const { DOCS_MENU_UPDATES } = await import(
    path.join(root, "apps/www/src/config/update.ts")
  );
  return Promise.all(
    Object.keys(SHOWCASES).map((component) =>
      spotlight(
        DOCS_MENU_UPDATES[component] === "New" ? "new" : "showcase",
        component
      )
    )
  );
}

let jobs: Job[];
if (command === "teaser") {
  jobs = [{ file: "teaser.mp4", id: "Teaser", props: {} }];
} else if (command === "all") {
  jobs = await everyComponent();
} else if (
  (command === "new" || command === "update" || command === "showcase") &&
  name
) {
  jobs = [await spotlight(command, name)];
} else {
  fail(
    "Usage: bun run new|update|showcase <name> [--note …] | bun run all | bun run teaser"
  );
}

console.log("Bundling…");
const serveUrl = await bundle({
  entryPoint: path.resolve(import.meta.dir, "../src/index.ts"),
  webpackOverride,
});

// One video at a time: each render already uses every core.
for (const [index, job] of jobs.entries()) {
  // biome-ignore lint/performance/noAwaitInLoops: renders run one after the other on purpose
  const composition = await selectComposition({
    id: job.id,
    inputProps: job.props,
    serveUrl,
  });
  const outputLocation = path.join(out, job.file);
  const counter = jobs.length > 1 ? `[${index + 1}/${jobs.length}] ` : "";
  let shown = -1;
  await renderMedia({
    codec: "h264",
    composition,
    crf: 16,
    inputProps: job.props,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 100);
      if (percent % 10 === 0 && percent !== shown) {
        shown = percent;
        console.log(`${counter}${job.file} ${percent}%`);
      }
    },
    outputLocation,
    serveUrl,
  });
  console.log(`→ ${path.relative(process.cwd(), outputLocation)}`);
}
